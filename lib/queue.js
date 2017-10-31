/** @babel */
export class IdleHandler {

    constructor({queue} = {}) {
        this.id = -1;
        this.when = 0;
        this.queue = queue;
    }

    idle(when=0,delay=0) {
        this.queue.addIdleHandler(this, this.when = when);
        this.id = setTimeout(() => {
            this.unIdle();
        }, delay);
    }

    queueIdle() {
        return this.id !== -1;
    }

    unIdle() {
        let id = this.id;
        if (id) {
            this.id = -1;
            this.queue.removeIdleHandler(this.when);
            if (!this.queue.isInLoop()) {
                this.queue.dispatchMessage();
            }
            clearTimeout(id);
        }
    }

}

export class MessageQueue {

    constructor(quitAllowed = true) {
        this.mLooper = null;
        this.mMessages = null;
        this.mQuitting = false;
        this.mIdleHandlers = new Map();
        this.mQuitAllowed = quitAllowed;
        this.mLastMessage = null;
    }

    addIdleHandler(idleHandler = null, when=0) {
        if (!idleHandler) {
            throw new ReferenceError("Can't add a null IdleHandler");
        }
        if (!this.mIdleHandlers.has(when)) {
            this.mIdleHandlers.set(when, idleHandler);
        }
    }

    dispatchMessage(msg=null) {
        let handled = false;
        if (!msg) {
            msg = this.nextMessage();
        }
        if (msg) {
            let target = msg.target;
            if (!target) {
                return handled;
            }
            this.mLastMessage = msg;
            handled = target.dispatchMessage(msg);
            if (!handled) {
                target.unHandleMessage(msg);
            }
            msg.recycle();
        }
        return handled;
    }

    dispose() {
        this.mIdleHandlers = null;
        this.mLooper = null;
    }

    enqueueMessage(msg, when = 0) {
        if (msg.when !== 0) {
            throw new ReferenceError(msg + " This message is already in use.");
        }
        if (!msg.target && !this.mQuitAllowed) {
            throw new Error("Queue not allowed to quit");
        }
        if (this.mQuiting) {
            let e = new ReferenceError(
                msg.getTarget()
                + " sending message to a Handler on a dead queue");
            console.error(e);
            msg.recycle();
            return false;
        } else if (!msg.target) {
            this.mQuiting = true;
        }
        let handled = false;
        msg.markInUse();
        msg.when = when;
        if (!msg.isAsynchronous()) {
            handled = this.dispatchMessage(msg);
        } else {
            let p = this.mMessages;
            if (!p || when === 0 || when < p.when) {
                msg.next = p;
                this.mMessages = msg;
                if (!this.isInLoop()) {
                    handled = this.dispatchMessage();
                }
            } else {
                let prev = null;
                while (p && p.when <= when) {
                    prev = p;
                    p = p.next;
                }
                msg.next = prev.next;
                prev.next = msg;
                if (!this.isInLoop()) {
                    handled = this.dispatchMessage();
                }
            }
        }
        return handled;
    }

    hasMessages(h, val=NaN, object=null) {
        if (!h) {
            return false;
        }
        let p = this.mMessages || this.mLastMessage;
        if (!isNaN(val)) {
            while (p) {
                if (p.target === h && p.what === val && (!object || p.obj === object)) {
                    return true;
                }
                p = p.next;
            }
            return false;
        }
        while (p) {
            if (p.target === h && p.callback === val && (!object || p.obj === object)) {
                return true;
            }
            p = p.next;
        }
        return false;
    }

    hasHidleHandler(when=0) {
        return this.mIdleHandlers.has(when);
    }

    isIdle() {
        return !this.mMessages || Date.now() < this.mMessages.when;
    }

    isInLoop() {
        return this.mLooper && this.mLooper.isRunning();
    }

    nextMessage() {
        if (this.mQuiting) {
            return null;
        }
        let msg;
        let now = Date.now();
        if ((msg = this.pullNextLocked(now))) {
            msg.markInUse();
            return msg;
        } else {
            let idleHandlers = this.mIdleHandlers.values();
            for (const idleHandler of idleHandlers) {
                if (!idleHandler.queueIdle()) {
                    idleHandler.unIdle();
                }
            }
        }
        return null;
    }

    pullNextLocked(now = 0) {
        let p = this.mMessages;
        if (p) {
            while(p) {
                if (now >= p.when) {
                    this.mMessages = p.next;
                    return p;
                }
                let when = p.when;
                let delay = when - now;
                if (!this.hasHidleHandler(when)) {
                    let idleHandler = new IdleHandler({ queue: this });
                    idleHandler.idle(when, delay);
                }
                p = p.next;
            }
        }
        return p;
    }

    quit(safe) {
        if (!this.mQuitAllowed) {
            throw new Error("IllegalStateException queue not allowed to quit.");
        }
        if (this.mQuitting) {
            return;
        }
        this.mQuitting = true;
        if (safe) {
            this.removeFuturMessages();
        } else {
            this.removeMessages();
        }
        this.dispose();
    }

    removeCallbacksAndMessages(h, object=null) {
        if (!h) {
            return;
        }
        let p = this.mMessages || this.mLastMessage;
        let nn = null;
        let n = null;
        while (p && p.target === h && (!object || p.obj === object)) {
            n = p.next;
            if (n && n.target === h && (!object || n.obj === object)) {
                nn = n.next;
                n.recycle();
                p.next = nn;
            }
            p = n;
        }
    }

    removeIdleHandler(when=0) {
        let idleHandler = this.mIdleHandlers[when];
        if (this.mIdleHandlers.has(when)) {
            this.mIdleHandlers.delete(when);
        }
    }

    removeFuturMessages() {
        let now = Date.now();
        let p = this.mMessages || this.mLastMessage;
        if (p) {
            if (p.when > now) {
                this.removeMessages();
            } else {
                let n;
                for (; ;) {
                    n = p.next;
                    if (!n) {
                        return;
                    }
                    if (n.when > now) {
                        break;
                    }
                    p = n;
                }
                p.next = null;
                do {
                    p = n;
                    n = p.next;
                    p.recycle();
                } while (n);
            }
        }
    }

    removeMessages(h, val, object=null, doRemove=false) {
        if (!h) {
            return false;
        }
        let p = this.mMessages || this.mLastMessage;
        let nn = null;
        let n = null;
        if (typeof val === "number") {
            let found = false;
            while (p && p.target === h && p.what === val && (!object || p.obj === object)) {
                if (!doRemove) {
                    return true;
                }
                found = true;
                n = p.next;
                this.mMessages = n;
                p.recycle();
                p = n;
            }
            while (p) {
                n = p.next;
                if (n && n.target === h && (!object || n.obj === object)) {
                    if (!doRemove) {
                        return true;
                    }
                    found = true;
                    nn = n.next;
                    n.recycle();
                    p.next = nn;
                }
                p = n;
            }
            return found;
        }
        let r = val;
        if (!r) {
            return false;
        }
        p = this.mMessages || this.mLastMessage;
        while (p && p.target === h && p.callback === r && (!object || p.obj === object)) {
            n = p.next;
            this.mMessages = n;
            p.recycle();
            p = n;
        }
        if (!p) {
            return false;
        }
        while (p) {
            n = p.next;
            if (n && n.target === h && n.callback === r && (!object || p.obj === object)) {
                nn = n.next;
                n.recycle();
                p.next = nn;
            }
            p = n;
        }
        return true;
    }

}
