const { ServiceBroker } = require('moleculer');
const HTTPServer = require('moleculer-web');
const { MoleculerClientError } = require('moleculer').Errors;
const jwt = require('jsonwebtoken');
const DbConnection = require('./dbservice');
const mongoose = require('mongoose');
// const authMiddleware = require('./auth.middleware');
const authServices = require('./users.service');

const TodoSchema = new mongoose.Schema({
    title: String,
    description: String,
    completed: Boolean
})

const brokerNode1 = new ServiceBroker({
    nodeID: 'node-1',
    transporter: 'NATS'
});

const func = () => {
    console.log('Hi');
    return 1;
}

brokerNode1.createService({
    name: 'gateway',
    mixins: [HTTPServer],
    settings: {
        cors: {
            origin: '*',
            allowedHeaders: "*",
            credentials: true,
        },
        routes: [
            {
                path: '/api',
                aliases: {
                    'POST /signup': 'auth.create',
                    'POST /login': 'auth.login',
                    'POST /profile': 'auth.me'
                },
                authorization: false
            },
            {
                path: '/',
                aliases: {
                    'GET /greet': 'greet.welcome',
                    'GET /todos': 'todos.list',
                    'POST /todos': 'todos.add',
                    'PUT /todos/:id': 'todos.complete',
                    'DELETE /todos/:id': 'todos.delete'
                },
                authorization: true
            },
        ],
    },
    methods: {
        authorize(ctx, route, req, res) {
            // Read the token from header
            let authorization = req.headers["authorization"];
            if (authorization && authorization.startsWith("Bearer")) {
                const token = authorization.slice(7);
                console.log(token);
                try {
                    const decoded = jwt.verify(token, 'super-secret');
                    ctx.meta.user = decoded;
                    console.log(decoded);
                } catch (err) {
                    console.log(err);
                    throw new MoleculerClientError('Invalid token', 401, 'INVALID_TOKEN');
                }
            } else {
                // No token
                throw new MoleculerClientError('Invalid token', 401, 'INVALID_TOKEN');
            }
        }
    }
});

const brokerNode2 = new ServiceBroker({
    nodeID: 'node-2',
    transporter: 'NATS'
});

brokerNode2.createService({
    name: 'greet',
    actions: {
        welcome(ctx) {
            return "Hello";
        }
    }
});

const userBroker = new ServiceBroker({
    nodeID: 'userBroker',
    transporter: 'NATS'
})

userBroker.createService(authServices);

const todoBroker = new ServiceBroker({
    nodeID: 'todoBroker',
    transporter: 'NATS'
    //middlewares: [authMiddleware()]
})

todoBroker.createService({
    name: 'todos',
    mixins: [DbConnection('todos', TodoSchema)],
    actions: {
        list: {
            rest: 'GET /todos',
            async handler(ctx) {
                const todos = await this.adapter.find();
                return todos;
            }
        },
        add: {
            rest: 'POST /todos',
            async handler(ctx) {
                const { title, description } = ctx.params;
                const completed = false;
                const todo = await this.adapter.insert({
                    title,
                    description,
                    completed
                })
                return todo;
            }
        },
        complete: {
            rest: 'PUT /todos/:id',
            async handler(ctx) {
                const { id } = ctx.params;
                const completed = true;
                const todo = await this.adapter.updateById(id, { completed });
                if (!todo) {
                    throw new Error('Todo not found');
                }
                return todo;
            }
        },
        delete: {
            rest: 'DELETE /todos/:id',
            async handler(ctx) {
                const { id } = ctx.params;
                const todo = await this.adapter.removeById(id);
                if (!todo) {
                    throw new Error('Todo not found');
                }
                return 'Done!';
            }
        }
    },
    //localMiddlewares: [authMiddleware()]
})

// brokerNode2.start()
//     .then(() => brokerNode2.call('greet.welcome', { name: 'Yash' }))
//     .then(res => console.log(res))
//     .catch(err => console.error(`Error occured! ${err.message}`));

// Promise.all([brokerNode1.start(), todoBroker.start(), brokerNode2.start()]);

Promise.all([brokerNode1.start(), brokerNode2.start()])
    .then(() => {
        todoBroker.start()
        userBroker.start()
    })
    .then(() => {
        console.log('Services started successfully.');
    })
    .catch((err) => {
        console.error(`Error occurred while starting services: ${err.message}`);
    });