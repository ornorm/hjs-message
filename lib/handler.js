/** @babel */
import {Message} from "./message";
import {MessageQueue} from "./queue";
import {MessageBroadcaster} from './broadcast';

export class Callback {

    constructor({handleMessage = null} = {}) {
        if (handleMessage !== null) {
            this.handleMessage = handleMessage;
        }
    }

    handleMessage(handler, message) {
        return false;
    }

}

export class Runnable {

    constructor({run = null} = {}) {
        if (run !== null) {
            this.run = run;
        }
    }

    run(handler, token = null) {
        return true;
    }

}

export class BlockingRunnable extends Runnable {

    constructor(task) {
        super();
        this.reset(task);
    }

    isDone() {
        return this.mDone;
    }

    isTimeout() {
        return this.mIsTimeout;
    }

    notifyAll(msg) {
        this.mDone = true;
        this.mHandler.removeCallbacks(this);
        if (this.mIsTimeout) {
            msg.arg1 = BlockingRunnable.TIMEOUT;
        }
        this.mHandler.sendMessage(msg);
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

    postAndWait(handler, timeout=Infinity, scheduleTime=NaN, token=null) {
        this.mHandler = handler;
        this.mTimeout = timeout;
        this.mScheduleTime = scheduleTime;
        return this.mHandler.post(this, token);
    }

    reset(task) {
        if (this.mId !== null) {
            if (this.mMode === 0) {
                clearTimeout(this.mId);
            } else {
                clearInterval(this.mId);
            }
        }
        this.mTask = task;
        this.mId = -1;
        this.mMode = -1;
        this.mToken = null;
        this.mDone = false;
        this.mTimeout = Infinity;
        this.mScheduleTime = NaN;
        this.mIsTimeout = false;
        this.mHandler = null;
    }

    run(handler, token = null) {
        try {
            this.mToken = token;
            return (this.mMode = this.mTimeout !== Infinity && this.mTimeout > 0 ? 0 : 1) === 0 ?
                this.wait(Date.now() + this.mTimeout) :
                this.wait(isNaN(this.mScheduleTime) ?
                    handler.getScheduleTime() :
                    this.mScheduleTime);
        } catch (e) {
            this.mIsTimeout = true;
            this.notifyAll(this.mHandler.obtainMessage({
                what: BlockingRunnable.ERROR,
                obj: e
            }));
        }
        return false;
    }

    runTask() {
        if (!this.mDone || !this.mIsTimeout) {
            this.mTask.run(this, this.mToken);
        }
    }

    wait(expirationTime = 0) {
        if (!this.mDone) {
            if (this.mMode === 0) {
                let delay = expirationTime - Date.now();
                if (delay <= 0) {
                    return false;
                }
                this.runTask();
                this.mId = setTimeout((expirationTime) => {
                    this.onWait(expirationTime);
                }, delay, expirationTime);
            } else {
                if (this.mId === -1) {
                    this.mId = setInterval((expirationTime) => {
                        this.runTask();
                        this.onWait(expirationTime);
                    }, expirationTime, expirationTime);
                }
            }
        }
        return true;
    }
}
BlockingRunnable.ERROR = 0x00000000;
BlockingRunnable.TIMEOUT = 0xffffffff;

export class Messenger {

    constructor({
        binder = null,
        sendMessage = null
    }={}) {
        this.handler = binder;
        if (sendMessage) {
            this.sendMessage = sendMessage;
        }
    }

    getBinder() {
        return this.handler;
    }

    publish(msg) {
        if (this.handler) {
            if (!msg.replyTo) {
                msg.replyTo = this.handler;
            }
            this.handler.publish(msg);
        }
    }

    sendMessage(msg) {
        if (this.handler) {
            this.handler.sendMessage(msg);
        }
    }

    sendMessageTo(msg) {
        if (this.handler) {
            let h = msg.target;
            if (h !== this.handler) {
                let m = Message.obtain();
                m.copyFrom(msg);
                m.replyTo = this.handler;
                h.sendMessage(m);
            } else {
                this.sendMessage(msg);
            }
        }
    }

    setBinder(binder) {
        this.handler = binder;
    }

    subscribe(senderWhat, targetWhat) {
        if (this.handler) {
            this.handler.subscribe(senderWhat, targetWhat);
        }
    }

    unsubscribe(senderWhat, targetWhat) {
        if (this.handler) {
            this.handler.unsubscribe(senderWhat, targetWhat);
        }
    }

}

let SCHEDULE_TIME = 200;

const createPromiseCallback = (execute, resolve, reject) => {
    return {

        run(handler, token = null) {
            try {
                execute({resolve, reject, handler, token});
                return true;
            } catch (e) {
                reject(e);
                return false;
            }
        }

    };
};

export class MessageHandler {

    constructor({
        callback = null,
        asynchronous = true,
        queue = new MessageQueue(),
        messenger = new Messenger(),
        handleMessage = null,
        unHandleMessage = null,
        scheduleTime = SCHEDULE_TIME
    } = {}) {
        if (handleMessage) {
            this.handleMessage = handleMessage;
        }
        if (unHandleMessage) {
            this.unHandleMessage = unHandleMessage;
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
            return message.callback ?
                this.handleCallback(message) :
                this.mCallback ?
                    this.mCallback.handleMessage(this, message) :
                    this.handleMessage(message);
        }
        return false;
    }

    enqueueMessage(queue, msg, uptimeMillis = 0, atFront = false) {
        msg.target = this;
        msg.setAsynchronous(atFront ? false : this.mAsynchronous);
        return queue.enqueueMessage(msg, uptimeMillis);
    }

    getBroadcaster() {
        return MessageBroadcaster.getInstance();
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

    getPostMessage({
        when = 0,
        what = 0,
        arg1 = 0,
        arg2 = 0,
        data = null,
        obj = null,
        replyTo = null,
        target = null,
        callback = null
    } = {}) {
        return Message.obtain({when, what, arg1, arg2, data, obj, replyTo, target, callback});
    }

    getScheduleTime() {
        return this.mScheduleTime;
    }

    handleCallback(msg) {
        if (msg && msg.callback) {
            return msg.callback.run(this, msg.obj);
        }
        return false;
    }

    handleMessage(msg) {
        return true;
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

    post(callback, token = null) {
        return this.sendMessageDelayed(this.getPostMessage({callback, obj: token}), 0);
    }

    postAtFrontOfQueue(callback, token = null) {
        return this.sendMessageAtFrontOfQueue(this.getPostMessage({callback, obj: token}));
    }

    postAtTime(callback, uptimeMillis = 0, token = null) {
        return this.sendMessageAtTime(this.getPostMessage({callback, obj: token}), uptimeMillis);
    }

    postDelayed(callback, delayMillis = 0, token = null) {
        return this.sendMessageDelayed(this.getPostMessage({callback, obj: token}), delayMillis);
    }

    promise({execute, complete = null, token = null}={}) {
        let p = new Promise((resolve, reject) => {
            this.post(createPromiseCallback(execute, resolve, reject), token);
        });
        if (handleResult) {
            p.then(complete)
                .catch(complete);
        }
        return p;
    }

    promiseAtFrontOfQueue({execute, complete = null, token = null}={}) {
        let p = new Promise((resolve, reject) => {
            this.postAtFrontOfQueue(createPromiseCallback(execute, resolve, reject), token);
        });
        if (complete) {
            p.then(complete)
                .catch(complete);
        }
        return p;
    }

    promiseAtTime({execute, complete = null, uptimeMillis = 0, token = null}={}) {
        let p = new Promise((resolve, reject) => {
            this.postAtTime(createPromiseCallback(execute, resolve, reject), uptimeMillis, token);
        });
        if (complete) {
            p.then(complete)
                .catch(complete);
        }
        return p;
    }

    promiseDelayed({execute, complete = null, delayMillis = 0, token = null}={}) {
        let p = new Promise((resolve, reject) => {
            this.postDelayed(createPromiseCallback(execute, resolve, reject), delayMillis, token);
        });
        if (complete) {
            p.then(complete)
                .catch(complete);
        }
        return p;
    }

    publish(msg) {
        this.getBroadcaster().publish(msg);
    }

    removeCallbacks(callback, token = null) {
        this.mQueue.removeMessages(this, callback, token);
    }

    removeCallbacksAndMessages(token) {
        this.mQueue.removeCallbacksAndMessages(this, token);
    }

    removeMessages(what=0, object = null) {
        this.mQueue.removeMessages(this, what, object, true);
    }

    runWithScissors(callback, timeout = Infinity, scheduleTime = SCHEDULE_TIME, token=null) {
        if (!callback) {
            throw new ReferenceError("IllegalArgumentException runnable must not be null");
        }
        let asynchronous = !isNaN(timeout);
        if (asynchronous && timeout < 0) {
            throw new RangeError("IllegalArgumentException timeout must be non-negative");
        }
        if (!asynchronous) {
            try {
                callback.run(this, token);
                return true;
            } catch (e) {
                return false;
            }
        }
        let br = new BlockingRunnable(callback);
        return br.postAndWait(this, timeout, scheduleTime, token);
    }

    sendEmptyMessage(what) {
        return this.sendEmptyMessageDelayed(what, 0);
    }

    sendEmptyMessageAtFrontOfQueue(what) {
        let msg = Message.obtain({what});
        return this.sendMessageAtFrontOfQueue(msg);
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
        return this.enqueueMessage(queue, msg, 0, true);
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

    subscribe(senderWhat, targetWhat) {
        this.getBroadcaster().subscribe(senderWhat, this, targetWhat);
    }

    toString() {
        return `
      Handler (${this.constructor.name}) {}
    `;
    }

    unHandleMessage(msg) {

    }

    unsubscribe(senderWhat, targetWhat) {
        this.getBroadcaster().unsubscribe(senderWhat, this, targetWhat);
    }

}

