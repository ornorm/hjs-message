/** @babel */
export const FLAG_IN_USE = 1 << 0;
export const FLAG_ASYNCHRONOUS = 1 << 1;
export const FLAGS_TO_CLEAR_ON_COPY_FROM = FLAG_IN_USE;

const MAX_POOL_SIZE = 50;

let sPoolSize = 0;
let sPool = null;

export class Message {

    constructor({
        when = 0,
        state = 0,
        what = 0,
        arg1 = 0,
        arg2 = 0,
        data = new Map(),
        obj = null,
        replyTo = null,
        target = null,
        callback = null
    } = {}) {
        this.next = null;
        this.update({when, state, what, arg1, arg2, data, obj, replyTo, target, callback});
    }

    clearForRecycle() {
        this.state = 0;
        this.when = 0;
        this.what = 0;
        this.arg1 = 0;
        this.arg2 = 0;
        this.callback = null;
        this.replyTo = null;
        this.target = null;
        this.data = null;
        this.obj = null;
    }

    copyFrom(message) {
        if (message instanceof Message) {
            this.update({
                state: message.state & ~FLAGS_TO_CLEAR_ON_COPY_FROM,
                what: message.what,
                arg1: message.arg1,
                arg2: message.arg2,
                obj: message.obj,
                data: message.data,
                replyTo: message.replyTo
            })
        }
    }

    deserialize(message) {
        if (typeof message === 'string') {
            this.update(JSON.parse(message));
        }
    }

    getCallback() {
        return this.callback;
    }

    getData() {
        return this.data;
    }

    getObj() {
        return this.obj;
    }

    getTarget() {
        return this.target;
    }

    getWhat() {
        return this.what;
    }

    getWhen() {
        return this.when;
    }

    isAsynchronous() {
        return (this.state & FLAG_ASYNCHRONOUS) !== 0;
    }

    isInUse() {
        return ((this.state & FLAG_IN_USE) === FLAG_IN_USE);
    }

    markInUse() {
        this.state |= FLAG_IN_USE;
    }

    static obtain(message = null) {
        let m = null;
        if (!message) {
            if (sPool !== null) {
                m = sPool;
                sPool = m.next;
                m.next = null;
                m.flags = 0; // clear in-use flag
                sPoolSize--;
                return m;
            }
            return new Message();
        } else {
            let orig = message;
            m = Message.obtain();
            if (orig instanceof Message) {
                m.what = orig.what;
                m.arg1 = orig.arg1;
                m.arg2 = orig.arg2;
                m.obj = orig.obj;
                m.replyTo = orig.replyTo;
                if (orig.data !== null) {
                    m.data = new Map(orig.data);
                }
                m.target = orig.target;
                m.callback = orig.callback;
                return m;
            } else {
                m.update(orig);
            }
            return m;
        }
    }

    peekData() {
        return this.data;
    }

    recycle() {
        this.clearForRecycle();
        if (sPoolSize < MAX_POOL_SIZE) {
            this.next = sPool;
            sPool = this;
            sPoolSize++;
        }
    }

    sendToTarget() {
        if (this.target) {
            this.target.sendMessage(this);
        }
    }

    serialize() {
        return JSON.stringify({
            state: this.state,
            what: this.what,
            arg1: this.arg1,
            arg2: this.arg2,
            obj: this.obj,
            data: this.data,
            when: this.when
        });
    }

    setAsynchronous(asynchronous) {
        if (asynchronous) {
            this.state |= FLAG_ASYNCHRONOUS;
        } else {
            this.state &= ~FLAG_ASYNCHRONOUS;
        }
    }

    setCallback(callback) {
        this.callback = callback;
    }

    setData(data) {
        this.data = data;
    }

    setTarget(target) {
        this.target = target;
    }

    toString() {
        let now = Date.now();
        let duration = this.when - now;
        let str = "Message{\n";
        str += "state:" + this.state + ",\n";
        str += "when:" + duration + ",\n";
        if (this.target !== null) {
            if (this.callback !== null) {
                str += "callback:" + this.callback.constructor.name + ",\n";
            } else {
                str += "what:" + this.what + ",\n";
            }
            if (this.arg1 !== 0) {
                str += "arg1:" + this.arg1 + ",\n";
            }
            if (this.arg2 !== 0) {
                str += "arg2:" + this.arg2 + ",\n";
            }
            if (this.obj !== null) {
                str += "obj:" + this.obj + ",\n";
            }
            str += "target:" + this.target.constructor.name + ",\n";
            if (this.replyTo !== null) {
                str += "replyTo:" + this.replyTo.constructor.name + ",\n";
            }
        } else {
            str += "barrier:" + this.arg1 + ",\n";
        }
        if (this.data !== null) {
            str += "data:" + this.data.toString();
        }
        str += "}";
        return str;
    }

    update({
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
        this.when = when;
        this.state = state;
        this.what = what;
        this.arg1 = arg1;
        this.arg2 = arg2;
        this.obj = obj;
        this.replyTo = replyTo;
        this.target = target;
        this.callback = callback;
        this.data = data;
    }
}