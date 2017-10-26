/** @babel */
export class IdleHandler {

    constructor({queueIdle = null} = {}) {
        if (queueIdle !== null) {
            this.queueIdle = queueIdle;
        }
    }

    queueIdle() {
        return false;
    }

}

export class MessageQueue {

    constructor(quitAllowed = true) {
        this.mWaiters = {};
        this.mLooper = null;
        this.mMessages = null;
        this.mQuitting = false;
        this.mIdleHandlers = [];
        this.mQuitAllowed = quitAllowed;
    }

    addIdleHandler(idleHandler = null) {
        if (!idleHandler) {
            throw new ReferenceError("Can't add a null IdleHandler");
        }
        this.mIdleHandlers.push(idleHandler);
    }

    dispatchMessage() {
        let msg = this.nextMessage();
        if (msg) {
            if (!msg.target) {
                return this;
            }
            msg.target.dispatchMessage(msg);
            msg.recycle();
        }
        return null;
    }

    dispose() {
        this.mWaiters = null;
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
        msg.markInUse();
        msg.when = when;
        let p = this.mMessages;
        if (!p || when === 0 || when < p.when) {
            msg.next = p;
            this.mMessages = msg;
            if (!this.mLooper ||
                !this.mLooper.isRunning()) {
                this.dispatchMessage();
            } else {
                console.log("message not dispatched 1");
            }
        } else {
            console.log('case 2');
            let prev = null;
            while (p && p.when <= when) {
                prev = p;
                p = p.next;
            }
            msg.next = prev.next;
            prev.next = msg;
            if (!this.mLooper ||
                !this.mLooper.isRunning()) {
                this.dispatchMessage();
            } else {
                console.log("message not dispatched 2");
            }
        }
        return true;
    }

    hasMessages(h, val, object) {
        if (!h) {
            return false;
        }
        let p = this.mMessages;
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

    isIdle() {
        return !this.mMessages || Date.now() < this.mMessages.when;
    }

    nextMessage() {
        if (this.mQuiting) {
            return null;
        }
        let tryIdle = true;
        let didIdle = false;
        let now = Date.now();
        let idlers;
        let keep;
        let len;
        let msg;
        while ((msg = this.pullNextLocked(now))) {
            if (msg) {
                msg.markInUse();
                return msg;
            }
            if (tryIdle && this.mIdleHandlers.length > 0) {
                idlers = this.mIdleHandlers.slice(0, this.mIdleHandlers.length);
            }
            if (idlers) {
                len = idlers.length;
                for (const idler of idlers) {
                    keep = false;
                    didIdle = true;
                    keep = idler.queueIdle();
                    if (!keep) {
                        this.removeIdleHandler(idler);
                    }
                }
            }
            if (didIdle) {
                tryIdle = false;
            }
            if (this.mQuitting) {
                return null;
            }
            now = Date.now();
        }
        return null;
    }

    pullNextLocked(now = 0) {
        let msg = this.mMessages;
        if (msg) {
            if (now >= msg.when) {
                this.mMessages = msg.next;
                return msg;
            }
            let when = msg.when;
            let delay = when - now;
            if (!this.mWaiters[when]) {
                this.mWaiters[when] = setTimeout(
                    () => {
                        let id = this.mWaiters[when];
                        if (id) {
                            if (!this.mLooper ||
                                !this.mLooper.isRunning()) {
                                this.dispatchMessage();
                            }
                            this.mWaiters[when] = null;
                            clearTimeout(id);
                        }
                    }, delay);
            } else {
                console.log("WAITING " + delay + " MS");
            }
        }
        return null;
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

    removeCallbacksAndMessages(h, object) {
        if (!h) {
            return;
        }
        let p = this.mMessages;
        let nn = null;
        let n = null;
        while (p && p.target === h && (!object || p.obj === object)) {
            n = p.next;
            if (n && n.target === h && (!object || n.obj === object)) {
                nn = n.next;
                n.recycle();
                p.next = nn;
                continue;
            }
            p = n;
        }
    }

    removeIdleHandler(handler) {
        let index = this.mIdleHandlers.indexOf(handler);
        if (index !== -1) {
            this.mIdleHandlers.splice(index, 1);
        }
    }

    removeFuturMessages() {
        let now = Date.now();
        let p = this.mMessages;
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

    removeMessages(h, val, object, doRemove) {
        if (!h) {
            return false;
        }
        let p = this.mMessages;
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
                    continue;
                }
                p = n;
            }
            return found;
        }
        let r = val;
        if (!r) {
            return false;
        }
        p = this.mMessages;
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
                continue;
            }
            p = n;
        }
        return true;
    }

}
