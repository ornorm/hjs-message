# HJS-MESSAGE
> Messaging API of the Hubrisjs javascript framework.

Messaging classes: MessageBroadcaster, MessageHandler, MessageQueue and CountDownTimer.

## Installation

Node:

```sh
npm install hjs-message --save
```
## Usage
 You must before defines a **Message** containing a description and arbitrary data object that can be sent to a 
 **MessageHandler**. 
 
 This object contains two extra int fields and an extra object field that allow you to not do 
 allocations in many cases.
 
 >While the constructor of **Message** is public, the best way to get one of these is to call **Message.obtain()** 
 or one of the **MessageHanlder.obtainMessage()** methods, which will pull them from a pool of recycled objects.
    
 A **MessageHandler** allows you to send and process **Message** and **Runnable** objects associated with a 
 **MessageQueue**.
 
 Each **MessageHandler** instance is associated with a single message queue. When you create a new **MessageHandler**,
 it is bound to the message queue that is passed has parameter or by an anonymous queue created by the message handler
 instance if no message queue is specified.
 
 From that point on, it will deliver messages and runnables to that message queue and execute them as they come out of 
 the message queue.
 
 There are two main uses for a **MessageHandler**:
 1. to schedule messages and runnables to be executed as some point in the future;
 2. to enqueue an action to be performed in a **Looper**.
 
 Scheduling messages is accomplished with the:
 - post(Runnable, Object=null)
 - postAtFrontOfQueue(Runnable, Object=null)
 - postAtTime(Runnable, long=0, Object=null)
 - postDelayed(Runnable, long=0, Object=null)
 - promise({Function,Function=null,Object=null})
 - promiseAtFrontOfQueue({Function,Function=null,Object=null})
 - promiseAtTime({Function, Function=null, long=0, Object=null})
 - promiseDelayed({Function, Function=null, long=0, Object=null})
 - runWithScissors(Runnable, long=0, scheduleTime=200)
 - sendEmptyMessage(int)
 - sendEmptyMessageAtFrontOfQueue(int)
 - sendEmptyMessageAtTime(int, long=0)
 - sendEmptyMessageDelayed(int, long=0)
 - sendMessage(Message)
 - sendMessageAtFrontOfQueue(Message)
 - sendMessageAtTime(Message, long=0)
 - sendMessageDelayed(Message, long=0)

The promise version allow to work with **Promise** objects that are standard promise.

The post versions allow you to enqueue Runnable objects to be called by the message queue when they are received.

The sendMessage versions allow you to enqueue a **Message** object containing a bundle of data that will be processed by 
the **MessageHandler**'s **handleMessage(Message)** method (requiring that you implement the method with your own code).

When posting or sending to a **MessageHandler**, you can either allow the item to be processed as soon as the message 
queue is ready to do so, or specify a delay before it gets processed or absolute time for it to be processed. The
latter two allow you to implement timeouts, ticks, and other timing-based behavior.

###### Create an empty message

```javascript
import {Message} from 'hjs-message';

const EMPTY_MSG = Message.obtain();
```
###### Create a filled message

```javascript
import {Message} from 'hjs-message';

const START_CMD = 0xffddcc;
const START_ARG1 = 1;
const START_ARG2 = 2;

const START_MAP = new Map();
START_MAP.put("key", "My value");

const START_OBJ = {
    data: "started"  
};

const START_MSG = Message.obtain({
    what: START_CMD /*always a required integer*/,
    arg1: START_ARG1 /*always an optional integer*/,
    arg2: START_ARG2 /*always an optional integer*/,
    data: START_MAP /*always an optional map*/,
    obj: START_OBJ /*always an optional object*/
});
```
###### Serialize/Deserialize a message to/from json

```javascript
import {Message} from 'hjs-message';

const START_MSG = Message.obtain({
    what: 0xffccddee /*always a required integer*/,
    obj: { msg: "hello world" } /*always an optional object*/
});

let serialized = START_MSG.serialize();
console.log(serialized);

START_MSG.deserialize(serialized);

console.log(START_MSG.toString());
```
###### Create a message handler

```javascript
import {Message,MessageHandler} from 'hjs-message';

let H = MessageHandler.create({

    handleMessage: (msg) => {
        //handle your message here
        //mark the message has not handled with false otherwise true
        return false;
    },

    unHandleMessage(msg) {
       // un handled message came here
       
       /* 
       Warning never resend the same message 
       But if you need to do that make something like the code below
       Caution code like this can lead to infinite loop
       */    
       
       // obtain a message
       let cp = Message.obtain();
       
       // copy the original
       cp.copyFrom(msg);
       
       // resend the copy
       this.sendMessage(cp);
   
    }

});
```
###### Create a message handler with a callback

```javascript
import {Callback,MessageHandler} from 'hjs-message';

//define a callback
let callback = new Callback({

    handleMessage: (handler, msg) => {
        //handle your message here
        //mark the message has handled
        return true;
    }
    
});

//somewhere in the code
let H = MessageHandler.create({ callback });
```
###### Create a message handler with a custom messenger

```javascript
import {Message,Messenger,MessageHandler} from 'hjs-message';

const DELAY_CODE = 0xddeeff;
const DEFAULT_CODE = 0xddeeaa;

//define a messenger
const M = new Messenger({
    
    sendMessage(msg) {
        let what = msg.what;
        let binder = this.getBinder();
        if (binder) {
            if (what === DELAY_CODE) {
                binder.sendMessageDelayed(msg, 1000);
            } else {
                binder.sendMessage(msg);
            }
        }
    }
    
});

//somewhere in the code
let H = MessageHandler.create({
    
    messenger: M,
    handleMessage: (msg) => {
        let what = msg.what;
        //handle your message here
        //mark the message has not handled
        return what === DEFAULT_CODE || what === DELAY_CODE;
    }

});

//later in the code
M.sendMessage(Message.obtain({
    what: DELAY_CODE
}));
M.sendMessage(Message.obtain({
    what: DEFAULT_CODE
}));
```
###### Use messenger to send and reply to message across channels

```javascript
import {Message,MessageHandler} from 'hjs-message';

const HELLO_SEND_CHANNEL = 0x1;
const HELLO_RECEIVED_CHANNEL = 0x2;

const BYEBYE_CODE = 0x3;

let H1 = MessageHandler.create({

    handleMessage(msg) {
        let what = msg.what;
        if (what === HELLO_RECEIVED_CHANNEL) {
            console.log("HELLO_RECEIVED_CHANNEL");
            // a message is received in the hello channel
            let messenger = this.getMessenger();
            // who sent the message ?
            let reply = msg.replyTo;
            // reply to the messenge directly channels not needed
            messenger.sendMessageTo(reply.obtainMessage({
                what: BYEBYE_CODE
            }));
        }
        return true;
    }

});
// get the default messenger
let M1 = H1.getMessenger();
// Subscribe to receive messages across channels
M1.subscribe(HELLO_SEND_CHANNEL, HELLO_RECEIVED_CHANNEL);

// later somewhere in an another script
let H2 = MessageHandler.create({

    handleMessage(msg) {
        let what = msg.what;
        if (what === BYEBYE_CODE) {
            console.log("BYEBYE_CODE");
            let messenger = this.getMessenger();
            // who sent the message ?
            let reply = msg.replyTo;
            console.log(reply);
        }
        return true;
    }

});
// get the default messenger
let M2 = H2.getMessenger();
// Publish to send messages across channels
M2.publish(Message.obtain({
    what: HELLO_SEND_CHANNEL
}));
```
###### Send an empty message

```javascript
import {MessageHandler} from 'hjs-message';

const EMPTY_CODE = 0x1;

let H = MessageHandler.create({
    
    handleMessage: (msg) => {
        let what = msg.what;
        return what === EMPTY_CODE;
    }

});

H.sendEmptyMessage(EMPTY_CODE);
```
###### Send an empty message at front of the queue

```javascript
import {MessageHandler} from 'hjs-message';

const FIRST_CODE = 0x1;
const SECOND_CODE = 0x2;
const FRONT_CODE = 0x3;

let H = MessageHandler.create({
    
    handleMessage(msg) {
        let what = msg.what;
        switch(what) {
            case FIRST_CODE:
                this.sendEmptyMessageAtFrontOfQueue(FRONT_CODE);
                break;
            case SECOND_CODE:
                //this code received after FRONT_CODE
                break;
            case FRONT_CODE:
                //this code received before SECOND_CODE
                break;
        }
        return true;
    }

});

H.sendEmptyMessage(FIRST_CODE);
H.sendEmptyMessage(SECOND_CODE);
```
###### Send an empty message at a specified time in the future
```javascript
import {MessageHandler} from 'hjs-message';

const HELLO_CODE = 0x11;

const START_TIME = Date.now();
const WAIT_TIME = 10000;
const UPTIME_MILLIS = START_TIME + WAIT_TIME;

let H = MessageHandler.create({
    
    handleMessage(msg) {
        let what = msg.what;
        let now = Date.now();
        let when = START_TIME;
        let ellapsed = now - when;
        let diff = UPTIME_MILLIS - when;
        //here we have a diff that is not exactly the same but is accurate
        //Because the queue use setTimeout internally that is not the most precise
        //handle your message here
        let handled = what === HELLO_CODE;
        if (handled) {
            let name = this.getMessageName(msg);
            console.log("now: " + now + ", when: " + when + ", ellapsed: " + ellapsed + ", diff: " + diff);
        }
        return handled;
    }
    
});

H.sendEmptyMessageAtTime(HELLO_CODE, UPTIME_MILLIS);
```
###### Send an empty message with a delay

```javascript
import {MessageHandler} from 'hjs-message';

const DELAY_CODE = 0x08;
const DELAY_MILLIS = 100;

let H = MessageHandler.create({

    handleMessage(msg) {
        let what = msg.what;
        let now = Date.now();
        let when = START_MILLIS;
        let ellapsed = now - when;
        let handled = what === DELAY_CODE;
        if (handled) {
            let name = this.getMessageName(msg);
            console.log("now: " + now + ", when: " + when + ", ellapsed: " + ellapsed);
        }
        return handled;
    }
    
});

const START_MILLIS = Date.now();
H.sendEmptyMessageDelayed(DELAY_CODE, DELAY_MILLIS);
```
###### Send a message

```javascript
import {MessageHandler} from 'hjs-message';

const WHAT_CODE = 0xddeeff;

let H = MessageHandler.create({
    
    handleMessage(msg) {
        let what = msg.what;
        //handle your message here
        let handled = what === WHAT_CODE;
        if (handled) {
            let name = this.getMessageName(msg);
            console.log("received msg named " + name);
            let obj = msg.obj;
            console.log(msg.obj.msg);
        }
        return handled;
    }
    
});

let MSG = H.obtainMessage({
    what: WHAT_CODE,
    obj: {
        msg: 'Hello world'
    }
});

H.sendMessage(MSG);
```
###### Send a message at the front of the queue

```javascript
import {MessageHandler} from 'hjs-message';

const FIRST_CODE = 0xffeeff;
const EMPTY_CODE = 0xffddff;
const PRIORITY_CODE = 0xcceeff;

let H = MessageHandler.create({
    
    handleMessage(msg) {
        let what = msg.what;
        //handle your message here
        let handled = false;
        let name = this.getMessageName(msg);
        let obj = msg.obj;
        switch(what) {
            case FIRST_CODE:
                console.log(msg.obj.msg);
                handled = true;
                //this message is dispatched before EMPTY_CODE message
                this.sendMessageAtFrontOfQueue(MSG_PRIORIY);
                break;
            case PRIORITY_CODE:
                console.log(msg.obj.msg);
                handled = true;
                break;
            case EMPTY_CODE:
                //this message is received after MSG_PRIORIY but it was sended before it
                break;
        }
        return handled;
    }
    
});

let MSG_PRIORIY = H.obtainMessage({
    what: PRIORITY_CODE,
    obj: {
        msg: 'I m executed before any message'
    }
});

let FIRST_MSG = H.obtainMessage({
    what: FIRST_CODE,
    obj: {
        msg: 'I m the first message'
    }

});

//first message
H.sendMessage(FIRST_MSG);
//second message
H.sendEmptyMessage(EMPTY_CODE);
```
###### Send a message at a specified time in the future

```javascript
import {MessageHandler} from 'hjs-message';

const HELLO_CODE = 0x11;
const START_TIME = Date.now();
const WAIT_TIME = 10000;
const UPTIME_MILLIS = START_TIME + WAIT_TIME;

let H = MessageHandler.create({
    
    handleMessage(msg) {
        let what = msg.what;
        let now = Date.now();
        let when = START_TIME;
        let ellapsed = now - when;
        let diff = UPTIME_MILLIS - when;
        //here we have a diff that is not exactly the same but is accurate
        //Because the queue use setTimeout internally that is not the most precise
        //handle your message here
        let handled = what === HELLO_CODE;
        if (handled) {
            let name = this.getMessageName(msg);
            console.log("now: " + now + ", when: " + when + ", ellapsed: " + ellapsed + ", diff: " + diff);
        }
        return handled;
    }
    
});

let MSG_FUTURE = H.obtainMessage({
    what: HELLO_CODE,
    obj: {
        msg: 'hello executed in the future'
    }

});

H.sendMessageAtTime(MSG_FUTURE, UPTIME_MILLIS);
```
###### Send a message with a delay

```javascript
import {MessageHandler} from 'hjs-message';

const DELAY_CODE = 0x21;
const DELAY_MILLIS = 100;

let H = MessageHandler.create({
    
    handleMessage(msg) {
        let what = msg.what;
        let now = Date.now();
        let when = START_MILLIS;
        let ellapsed = now - when;
        //handle your message here
        let handled = what === DELAY_CODE;
        if (handled) {
            let name = this.getMessageName(msg);
            console.log("now: " + now + ", when: " + when + ", ellapsed: " + ellapsed);
        }
        return handled;
    }
    
});

let MSG_DELAY = H.obtainMessage({
    what: DELAY_CODE,
    obj: {
        msg: 'hello executed with a delay'
    }

});

const START_MILLIS = Date.now();

H.sendMessageDelayed(MSG_DELAY, DELAY_MILLIS);
```
###### Post an anonymous runnable that is executed on the queue 

```javascript
import {MessageHandler} from 'hjs-message';

let H = MessageHandler.create();
H.post({
    
    run(handler, token=null) {
        // execute your code here
        return true;
    }
    
});
```
###### Post an runnable instance that is executed on the queue 

```javascript
import {MessageHandler,Runnable} from 'hjs-message';

let R = new Runnable({
    
    run(handler, token=null) {
        // execute your code here
        return true;
    }
    
});

//somewhere in the code
let H = MessageHandler.create();
H.post(R);
```
###### Post a runnable at front of the queue 

```javascript
import {MessageHandler,Runnable} from 'hjs-message';

let R = new Runnable({
    
    run(handler, token=null) {
        // execute your code here
        console.log(token.data);
        return true;
    }
    
});

//somewhere in the code
let H = MessageHandler.create();
H.postAtFrontOfQueue(R, { data: "My data" });
```
###### Post a runnable at a specified time in the future

```javascript
import {MessageHandler,Runnable} from 'hjs-message';

const START_TIME = Date.now();
const WAIT_TIME = 10000;
const UPTIME_MILLIS = START_TIME + WAIT_TIME;

let R = {
    
    run(handler, token=null) {
        console.log(token.data);
        let now = Date.now();
        let when = START_TIME;
        let ellapsed = now - when;
        let diff = UPTIME_MILLIS - when;
        console.log("now: " + now + ", when: " + when + ", ellapsed: " + ellapsed + ", diff: " + diff);
        return true;
    }
    
};

//we can associate a token object with the runnable
let T = { data:"A token that can be anything" };

//later in the code
let H = MessageHandler.create();
H.postAtTime(R, UPTIME_MILLIS, T);
```
###### Post a runnable with a delay

```javascript
import {MessageHandler,Runnable} from 'hjs-message';

const START_TIME = Date.now();
const DELAY_MILLIS = 100;

let R = {
    
    run(handler, token=null) {
        console.log(token.data);
        let now = Date.now();
        let when = START_MILLIS;
        let ellapsed = now - when;
        console.log("now: " + now + ", when: " + when + ", ellapsed: " + ellapsed);
        return true;
    }
    
};

const START_MILLIS = Date.now();

//we can associate a token object with the runnable
let T = { data:"A token that can be anything" };

//somewhere in the code
let H = MessageHandler.create();
H.postDelayed(R, DELAY_MILLIS, T);
```
###### Post a promise that is executed on the queue 

```javascript
import {MessageHandler} from 'hjs-message';

const loadData = (url, onComplete) => {
    //load data here...
};

let H = MessageHandler.create();

//somewhere in the code
H.promise({
    
    token: ['https://www.google.com'],
    
    execute({resolve, reject, handler, token=null}) {
        //make a long computation
        let url = token[0];
        loadData(url, (status, data) => {
            if (status === 200) {
                resolve(data);
            } else {
                reject(new URIError(url));
            }
        });
    },
    
    complete(result) {
        if (result instanceof Error) {
            //handle error
        } else {
            //parse data...
        }
    }
    
});
```
###### Post a promise that is executed on the queue with the then/catch syntax

```javascript
import {MessageHandler} from 'hjs-message';

const loadData = (url, onComplete) => {
    //load data here...
};

let H = MessageHandler.create();

//somewhere in the code
H.promise({
    
    token: ['https://www.google.com'],
    
    execute({resolve, reject, handler, token=null}) {
        //make a long computation
        let url = token[0];
        loadData(url, (status, data) => {
            if (status === 200) {
                resolve(data);
            } else {
                reject(new URIError(url));
            }
        });
    }
    
})
.then((result) => {
    //parse data...
})
.catch((e) => {
    //handle error
});
```
###### Post a promise at front of the queue 

```javascript
import {MessageHandler} from 'hjs-message';

const FIRST_CODE = 0x1;
const SECOND_CODE = 0x2;
const THIRD_CODE = 0x3;

let H = MessageHandler.create({

    handleMessage(msg) {
        let what = msg.what;
        switch (what) {
            case FIRST_CODE:
                this.promiseAtFrontOfQueue({

                    token: { timeout: 1000, text: 'executed' },

                    execute({resolve, reject, handler, token=null}) {
                        //this code is executed before SECOND_CODE
                        console.log("before SECOND_CODE promise posted");
                        let timeout = token.timeout;
                        let text = token.text;
                        setTimeout(() => {
                            resolve(text);
                        }, timeout);
                    },

                    complete: (result) => {
                        console.log("after SECOND_CODE promise resolved");
                        //but not this part
                        this.sendMessage(

                            this.obtainMessage({
                                what: THIRD_CODE,
                                obj : { result }
                            })

                        );
                    }

                });
                break;
            case SECOND_CODE:
                //this code is executed after the promise is posted
                console.log("SECOND_CODE after promise posted but before promise resolved");
                break;
            case THIRD_CODE:
                let result = msg.obj.result;
                console.log("THIRD_CODE last block executed");
                console.log(result);
                break;
        }
        return true;
    }

});

//later in the code
H.sendEmptyMessage(FIRST_CODE);
H.sendEmptyMessage(SECOND_CODE);
```
###### Post a promise at a time in the future 

```javascript
import {MessageHandler} from 'hjs-message';

const START_TIME = Date.now();
const WAIT_TIME = 10000;
const UPTIME_MILLIS = START_TIME + WAIT_TIME;

let H = MessageHandler.create();

//somewhere in the code
H.promiseAtTime({
    
    uptimeMillis: UPTIME_MILLIS,
    
    token: { 
        startTime: START_TIME,
        endTime: UPTIME_MILLIS,
        waitTime: WAIT_TIME
    },
    
    execute({resolve, reject, handler, token=null}) {
        //resolve result
        token.now = Date.now();
        resolve(token);
    },
    
    complete(result) {
        let now = result.now;
        let startTime = result.startTime;
        let waitTime = result.waitTime;
        let ellapsed = now - startTime;
        console.log("ellapsed: " + ellapsed + ", waitTime: " + waitTime);
    }
    
});
```
###### Post a promise with delay 

```javascript
import {MessageHandler} from 'hjs-message';

const START_TIME = Date.now();
const DELAY_MILLIS = 500;

let H = MessageHandler.create();

//somewhere in the code
H.promiseDelayed({
    
    delayMillis: DELAY_MILLIS,
    
    token: { 
        startTime: START_TIME,
        delayMillis: DELAY_MILLIS,
    },
    
    execute({resolve, reject, handler, token=null}) {
        //resolve result
        token.now = Date.now();
        resolve(token);
    },
    
    complete(result) {
        let now = result.now;
        let startTime = result.startTime;
        let delayMillis = result.delayMillis;
        let ellapsed = now - startTime;
        console.log("ellapsed: " + ellapsed + ", delayMillis: " + delayMillis);
    }
    
});
```
###### Run with scissors executing a task before a timeout is reached

```javascript
import {BlockingRunnable,Message,MessageHandler} from 'hjs-message';

let TIMEOUT_CODE = 0xdd;

const T = { data: "My computed data" };

const R = {

    run(task, token = null) {
        setTimeout(() => {

            task.notifyAll(Message.obtain({ what: TIMEOUT_CODE, obj: token }));

        }, 1500);
        return true;
    }

};

let H = MessageHandler.create({

    handleMessage(msg) {
        let what = msg.what;
        let handled = false;
        switch (what) {
            case BlockingRunnable.ERROR:
                // here msg.obj is an instanceof Error  
                handled = false;
                break;
            case TIMEOUT_CODE:
                let arg1 = msg.arg1;
                if (arg1 === BlockingRunnable.TIMEOUT) {
                    // timeout is reached
                    console.log("timeout msg handled");
                    handled = false;
                } else {
                    console.log(msg.obj.data);
                    handled = true;
                }
                break;
        }
        return handled;
    }

});

H.runWithScissors(
    R,
    1000/* The maximum time to wait before timeout */,
    0/* No polling interval */,
    T/* A token */
);
```
###### Run with scissors wainting until a task is executed

```javascript
import {BlockingRunnable,Message,MessageHandler} from 'hjs-message';

let COUNT = 0;

const R = {

    run(task, token = null) {
        console.log(COUNT);
        if (COUNT === 5) {
            // notify that the task is completed
            let msg = Message.obtain({ what: COUNT, obj: { data: "My computed data" } });
            task.notifyAll(msg);
        } else {
            COUNT = COUNT + 1;
        }
        return true;
    }

};

let H = MessageHandler.create({

    handleMessage(msg) {
        let what = msg.what;
        let handled = false;
        switch (what) {
            case BlockingRunnable.ERROR:
                // here msg.obj is an instanceof Error  
                handled = false;
                break;
            case COUNT:
                let arg1 = msg.arg1;
                if (arg1 === BlockingRunnable.TIMEOUT) {
                    // can't happen
                    handled = false;
                } else {
                    console.log(msg.obj.data);
                    handled = true;
                }
                break;
        }
        return handled;
    }

});

H.runWithScissors(
    R,
    Infinity/* Never exit */,
    200/* The polling interval */
);
```
###### Test if the queue contains a callback

```javascript
import {MessageHandler} from 'hjs-message';

const CODE = 0xff;

const T = {
    data: "A token"
};

const R = {

    run(handler, token=null) {
        console.log(token);
        return true;
    }

};


let H = MessageHandler.create();
H.postDelayed(R, 1000, T);


setTimeout(() => {
    
    // the message is present
    console.log(H.hasCallbacks(R));

}, 500);
```
###### Test if the queue contains a message

```javascript
import {MessageHandler} from 'hjs-message';

const CODE = 0xff;

const T = {
    data: "A token"
};

let H = MessageHandler.create({

    handleMessage(msg) {
        console.log(this.getMessageName(msg));
        return true;
    }

});

H.sendMessageDelayed(
    H.obtainMessage({
        what: CODE,
        obj: T
    }),
    1000
);

setTimeout(() => {
    
    // the message is present
    console.log(H.hasMessages(CODE));
    
}, 500);
```
###### Remove a callback from the queue

```javascript
import {MessageHandler} from 'hjs-message';

const CODE = 0xff;

const R = {

    run(handler, token=null) {
        // never executed
        console.log(token);
        return true;
    }

};

const T = {};

let H = MessageHandler.create();
H.postDelayed(R, 1000, T);


setTimeout(() => {

    if (H.hasCallbacks(R)) {
        H.removeCallbacks(R, T/* an optional token */);
    }

}, 500);
```
###### Remove a message from the queue

```javascript
import {MessageHandler} from 'hjs-message';

const CODE = 0xff;

const T = {
    data: "A token"
};

let H = MessageHandler.create({

    handleMessage(msg) {
        // never executed
        console.log(this.getMessageName(msg));
        return true;
    }

});

H.sendMessageDelayed(
    H.obtainMessage({
        what: CODE,
        obj: T
    }),
    1000
);

setTimeout(() => {

    if (H.hasMessages(CODE)) {
        // clean references
        H.removeMessages(CODE, T/* an optional token */);
    }

}, 500);
```
###### Remove callbacks and messages that have the same token

```javascript
import {MessageHandler} from 'hjs-message';

const CODE = 0xff;

const R = {

    run(handler, token=null) {
        let hasCallbacks = handler.hasCallbacks(this);
        let handled = hasCallbacks && token;
        if (handled) {
            // found token
            console.log(token);
            // clean references
            handler.removeCallbacksAndMessages(token);
        }
        return handled;
    }

};

const T = {
    data: "A token"
};

let H = MessageHandler.create({

    handleMessage(msg) {
        let what = msg.what;
        let token = msg.obj;
        let hasMessages = this.hasMessages(what);
        let handled = hasMessages && token;
        if (handled) {
            // found token
            console.log(token);
            if (this.post(R, token)) {
                // clean references
                this.removeCallbacksAndMessages(token);
            }
        }
        return handled;
    }

});

H.sendMessage(
    H.obtainMessage({
        what: CODE,
        obj: T
    })
);
```
###### Message broadcaster usage (PUB/SUB pattern)

```javascript
import {Message,MessageHandler} from 'hjs-message';

//Handler 1 channels
const SENDER1_CHANNEL = 0x1;
const RECEIVER1_CHANNEL = 0x3;
//Handler 2 channels
const SENDER2_CHANNEL = 0x2;
const RECEIVER2_CHANNEL = 0x4;

let H1 = MessageHandler.create({

    handleMessage(msg) {
        let what = msg.what;
        console.log("H1 > " + this.getMessageName(msg));
        if (what === RECEIVER1_CHANNEL) {
            // unsubscribe from the channel CODE1
            this.unsubscribe(SENDER1_CHANNEL, RECEIVER1_CHANNEL);
            // publish to the CODE2 channel
            this.publish(Message.obtain({what: SENDER2_CHANNEL}));

        }
        return true;
    }

});
// subscribe to the sender channel CODE1 and receive a CODE3
H1.subscribe(SENDER1_CHANNEL, RECEIVER1_CHANNEL);

let H2 = MessageHandler.create({

    handleMessage(msg) {
        let what = msg.what;
        console.log("H2 > " + this.getMessageName(msg));
        if (what === RECEIVER2_CHANNEL) {
            // publish to the channel CODE1
            this.publish(Message.obtain({what: SENDER1_CHANNEL}));

        }
        return true;
    }

});
// subscribe to the sender channel CODE2 and receive a CODE4
H2.subscribe(SENDER2_CHANNEL, RECEIVER2_CHANNEL);
// publish to the CODE2 channel
H2.publish(Message.obtain({what: SENDER2_CHANNEL}));
```
###### Count down timer usage

```javascript
import {CountDownTimer} from 'hjs-message';

let CDT = new CountDownTimer({
    
    millisInFuture: 500 /*time to count down*/,
    countDownInterval: 100 /*tick interval*/,

    onTick(millisUntilFinished) {
        console.log("ellapsed: " + millisUntilFinished);
        if (millisUntilFinished <= 200) {
            //cancel timer
            this.cancel();
        }
    },

    onFinish() {
        //timer complete
        if (this.isCancelled()) {
            console.log("TIMER CANCELLED");
        } else {
            console.log("TIMER COMPLETE");
        }
    }
    
});

//start the timer
CDT.start();
```
## Contacts

[Aime - abiendo@gmail.com](abiendo@gmail.com)

Distributed under the MIT license. See [``LICENSE``](./LICENSE.md) for more information.