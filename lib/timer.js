/** @babel */
import {MessageHandler} from './handler';

const MSG = 1;

export class CountDownTimer {

    constructor({
        millisInFuture = 0,
        countDownInterval = 0,
        onTick = null,
        onFinish = null
    } = {}) {
        this.mMillisInFuture = millisInFuture;
        this.mCountdownInterval = countDownInterval;
        this.mCancelled = false;
        if (onFinish) {
            this.onFinish = onFinish;
        }
        if (onTick) {
            this.onTick = onTick;
        }
        this.mHandler = MessageHandler.create({

            handleMessage: (msg) => {
                let handled = false;
                let h = this.mHandler;
                let t = Date.now();
                let millisLeft = this.mStopTimeInFuture - t;
                if (millisLeft <= 0) {
                    this.onFinish();
                } else if (millisLeft < this.mCountdownInterval) {
                    handled = h.sendMessageDelayed(h.obtainMessage({what: MSG}), millisLeft);
                } else {
                    let lastTickStart = Date.now();
                    this.onTick(millisLeft);
                    let delay = lastTickStart + this.mCountdownInterval - t;
                    while (delay < 0) {
                        delay += this.mCountdownInterval;
                    }
                    handled = h.sendMessageDelayed(h.obtainMessage({what: MSG}), delay);
                }
                return handled;
            }

        });

    }

    cancel() {
        this.mCancelled = true;
        this.mHandler.removeMessages(MSG);
        this.onFinish();
    }

    isCancelled() {
        return this.mCancelled;
    }

    onFinish() {
    }

    onTick(millisUntilFinished) {
    }

    start() {
        this.mCancelled = false;
        if (this.mMillisInFuture <= 0) {
            this.onFinish();
            return this;
        }
        this.mStopTimeInFuture = Date.now() + this.mMillisInFuture;
        this.mHandler.sendMessage(this.mHandler.obtainMessage({what: MSG}));
        return this;
    }

}
