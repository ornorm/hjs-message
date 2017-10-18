/** @babel */
import {Message} from './message';

export class Registration {

    constructor() {
        this.targets = [];
        this.targetWhats = [];
        this.targetWhats = null;
        this.senderWhat = 0;
        this.targets = null;
        this.next = null;
        this.prev = null;
    }

}

export class MessageBroadcaster {

    constructor() {
        this.mReg = null;
    }

    dumpRegistrations() {
        let start = this.mReg;
        console.log("MessageBroadcaster " + this + " {");
        if (start !== null) {
            let r = start;
            let s = "";
            let n = 0;
            do {
                s += "    senderWhat=" + r.senderWhat;
                n = r.targets.length;
                for (let i = 0; i < n; i++) {
                    s += "        [" + r.targetWhats[i] + "] " + r.targets[i] + "/n";
                }
                r = r.next;
            } while (r !== start);
            s += "}";
            console.log(s);
        }
    }

    publish(msg) {
        if (this.mReg === null) {
            return;
        }
        let senderWhat = msg.what;
        let start = this.mReg;
        let r = start;
        do {
            if (r.senderWhat >= senderWhat) {
                break;
            }
            r = r.next;
        } while (r !== start);
        if (r.senderWhat === senderWhat) {
            let targets = r.targets;
            let whats = r.targetWhats;
            let n = targets.length;
            let t = null;
            let m = null;
            for (let i = 0; i < n; i++) {
                t = targets[i];
                m = Message.obtain();
                m.copyFrom(msg);
                m.what = whats[i];
                t.sendMessage(m);
            }
        }
    }

    subscribe(senderWhat, handler, targetWhat) {
        let r = null;
        if (!this.mReg) {
            r = new Registration();
            r.senderWhat = senderWhat;
            r.targets = [handler];
            r.targetWhats = [targetWhat];
            this.mReg = r;
            r.next = r;
            r.prev = r;
        } else {
            let start = this.mReg;
            let n = 0;
            r = start;
            do {
                if (r.senderWhat >= senderWhat) {
                    break;
                }
                r = r.next;
            } while (r !== start);
            if (r.senderWhat !== senderWhat) {
                let reg = new Registration();
                reg.senderWhat = senderWhat;
                reg.targets = new Array(1);
                reg.targetWhats = new Array(1);
                reg.next = r;
                reg.prev = r.prev;
                r.prev.next = reg;
                r.prev = reg;
                if (r === this.mReg &&
                    r.senderWhat > reg.senderWhat) {
                    this.mReg = reg;
                }
                r = reg;
            } else {
                n = r.targets.length;
            }
            r.targets.splice(n, 0, handler);
            r.targetWhats.splice(n, 0, targetWhat);
        }
    }

    unsubscribe(senderWhat, handler, targetWhat) {
        let start = this.mReg;
        let r = start;
        if (this.mReg === null) {
            return;
        }
        do {
            if (r.senderWhat >= senderWhat) {
                break;
            }
            r = r.next;
        } while (r !== start);
        if (r.senderWhat === senderWhat) {
            let targets = r.targets;
            let whats = r.targetWhats;
            let oldLen = targets.length;
            for (let i = 0; i < oldLen; i++) {
                if (targets[i] === handler
                    && whats[i] === targetWhat) {
                    r.targets.splice(i, 1);
                    r.targetWhats.splice(oldLen - 1, 1);
                    break;
                }
            }
        }
    }
}
