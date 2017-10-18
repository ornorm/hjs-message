/** @babel */
import {Message} from './message';
import {IdleHandler,MessageQueue} from './queue';

export class Callback {

    constructor({handleMessage = null} = {}) {
        if (handleMessage !== null) {
            this.handleMessage = handleMessage;
        }
    }

    handleMessage(message) {
        return false;
    }

}

export class Runnable {

    constructor({run = null} = {}) {
        if (run !== null) {
            this.run = run;
        }
    }

    run() {

    }

}

export class BlockingRunnable {

    constructor(task) {
        this.reset(task);
    }

    isDone() {
        return this.mDone;
    }

    isTimeout() {
        return this.mIsTimeout;
    }

    notifyAll() {
        this.mDone = true;
    }

    onWait(expirationTime) {
        if (this.mMode === 0) {
            clearTimeout(this.mId);
            this.mId = -1;
        }
        if (!this.mDone) {
            if (!this.wait(expirationTime)) {
                this.mIsTimeout = true;
            }
        } else {
            if (this.mMode === 1) {
                clearInterval(this.mId);
                this.mId = -1;
            }
        }
    }

    postAndWait(handler, timeout, scheduleTime) {
        if (!handler.post(this)) {
            return false;
        }
        return (this.mMode = timeout > 0 ? 0 : 1) === 0 ?
            this.wait(Date.now() + timeout) :
            this.wait(isNaN(scheduleTime) ?
                handler.getScheduleTime() :
                scheduleTime);
    }

    reset(task) {
        if (this.mId !== null) {
            if (this.mMode === 0) {
                clearTimeout(this.mId);
            } else {
                clearInterval(this.mId);
            }
        }
        this.mId = -1;
        this.mMode = -1;
        this.mDone = false;
        this.mIsTimeout = false;
        this.mTask = task;
    }

    run() {
        try {
            if (this.mTask !== null) {
                this.mTask.run(this);
            }
        } catch (e) {
            this.notifyAll();
        }
    }

    wait(expirationTime) {
        if (!this.mDone) {
            if (this.mMode === 0) {
                let delay = expirationTime - Date.now();
                if (delay <= 0) {
                    return false;
                }
                this.mId = setTimeout(this.onWait.bind(this), delay, expirationTime);
            } else {
                if (this.mId === -1) {
                    this.mId = setInterval(this.onWait.bind(this), expirationTime);
                }
            }
        }
        return true;
    }
}

export class Messenger {

    constructor(handler) {
        this.handler = handler;
    }

    getBinder() {
        return this.handler;
    }

    sendMessage() {
        if (this.handler !== null) {
            this.handler.sendMessage(message);
        }
    }

    setBinder(binder) {
        this.handler = binder;
    }

}

let SCHEDULE_TIME = 200;

export class MessageHandler {

    constructor({
        callback = null,
        asynchronous = true,
        queue = new MessageQueue(),
        messenger = new Messenger(),
        handleMessage = null,
        scheduleTime = SCHEDULE_TIME
    } = {}) {
        if (handleMessage) {
            this.handleMessage = handleMessage;
        }
        this.mQueue = queue;
        this.mCallback = callback;
        this.mScheduleTime = scheduleTime;
        this.mAsynchronous = asynchronous;
        this.setMessenger(messenger);
    }

    static create({
        callback = null,
        asynchronous = true,
        queue = new MessageQueue(),
        messenger = new Messenger(),
        handleMessage = null,
        scheduleTime = SCHEDULE_TIME
    } = {}) {
        return new MessageHandler({callback, asynchronous, queue, messenger, handleMessage, scheduleTime});
    }

    dispatchMessage(message) {
        if (message) {
            message.callback ?
                this.handleCallback(message) :
                this.mCallback ?
                    this.mCallback.handleMessage(message) :
                    this.handleMessage(message);
        }
    }

    enqueueMessage(queue, msg, uptimeMillis = 0) {
        msg.target = this;
        msg.setAsynchronous(this.mAsynchronous);
        return queue.enqueueMessage(msg, uptimeMillis);
    }

    getMessageName(message) {
        if (message.callback) {
            return message.callback.constructor.name;
        }
        return "0x" + message.what.toString(16);
    }

    getMessenger() {
        return this.mMessenger;
    }

    getMessageQueue() {
        return this.mQueue;
    }

    getPostMessage(options) {
        return Message.obtain(options);
    }

    getScheduleTime() {
        return this.mScheduleTime;
    }

    handleCallback(msg) {
        if (msg) {
            msg.callback.run();
        }
    }

    handleMessage(msg) {
    }

    hasCallbacks(callback) {
        return this.mQueue.hasMessages(this, callback, null);
    }

    hasMessages(what, object = null) {
        return this.mQueue.hasMessages(this, what, object);
    }

    obtainMessage({
        when = 0,
        state = 0,
        what = 0,
        arg1 = 0,
        arg2 = 0,
        data = null,
        obj = null,
        replyTo = null,
        target = null,
        callback = null
    } = {}) {
        if (!target) {
            target = this;
        }
        return Message.obtain({when, state, what, arg1, arg2, data, obj, replyTo, target, callback});
    }

    post(callback) {
        return this.sendMessageDelayed(this.getPostMessage({callback}), 0);
    }

    postAtFrontOfQueue(callback) {
        return this.sendMessageAtFrontOfQueue(this.getPostMessage({callback}));
    }

    postAtTime(callback, token = null, uptimeMillis = 0) {
        return this.sendMessageAtTime(this.getPostMessage({
                callback,
                obj: token
            }),
            uptimeMillis);
    }

    postDelayed(callback, delayMillis = 0) {
        return this.sendMessageDelayed(this.getPostMessage({
                callback
            }),
            delayMillis);
    }

    removeCallbacks(callback, token = null) {
        this.mQueue.removeMessages(this, callback, token);
    }

    removeCallbacksAndMessages(token) {
        this.mQueue.removeCallbacksAndMessages(this, token);
    }

    removeMessages(what, object = null) {
        this.mQueue.removeMessages(this, what, object, true);
    }

    runWithScissors(callback, timeout = 0, scheduleTime = SCHEDULE_TIME) {
        if (!callback) {
            throw new ReferenceError("IllegalArgumentException runnable must not be null");
        }
        let asynchronous = !isNaN(timeout);
        if (asynchronous && timeout < 0) {
            throw new RangeError("IllegalArgumentException timeout must be non-negative");
        }
        if (!asynchronous) {
            callback.run();
            return true;
        }
        let br = new BlockingRunnable(callback);
        return br.postAndWait(this, timeout, scheduleTime);
    }

    sendEmptyMessage(what) {
        return this.sendEmptyMessageDelayed(what, 0);
    }

    sendEmptyMessageAtTime(what, uptimeMillis = 0) {
        let msg = Message.obtain({what});
        return this.sendMessageAtTime(msg, uptimeMillis);
    }

    sendEmptyMessageDelayed(what, delayMillis = 0) {
        let msg = Message.obtain({what});
        return this.sendMessageDelayed(msg, delayMillis);
    }

    sendMessage(msg) {
        return this.sendMessageDelayed(msg, 0);
    }

    sendMessageAtFrontOfQueue(msg) {
        let queue = this.mQueue;
        if (!queue) {
            console.error(this + " sendMessageAtFrontOfQueue() called with no mQueue");
            return false;
        }
        return this.enqueueMessage(this.mQueue, msg, 0);
    }

    sendMessageAtTime(msg, uptimeMillis = 0) {
        let queue = this.mQueue;
        if (!queue) {
            console.error(this + " sendMessageAtTime() called with no mQueue");
            return false;
        }
        return this.enqueueMessage(queue, msg, uptimeMillis);
    }

    sendMessageDelayed(msg, delayMillis = 0) {
        if (delayMillis < 0) {
            delayMillis = 0;
        }
        return this.sendMessageAtTime(msg, Date.now() + delayMillis);
    }

    setMessenger(messenger) {
        if (messenger !== null) {
            this.mMessenger = messenger;
            messenger.setBinder(this);
        }
    }

    setScheduleTime(interval) {
        this.mScheduleTime = interval;
    }

    static setSchedulerTime(scheduleTime) {
        SCHEDULE_TIME = scheduleTime;
    }

    toString() {
        return `
      Handler (${this.constructor.name}) {}
    `;
    }
}

