"use strict";

const _ = require('lodash');
const ApiGateway = require('moleculer-web');
const { UnAuthorizedError } = ApiGateway.Errors;

module.exports = {
    name: 'api',
    mixins: [ApiGateway],
    settings: {
        port: 3000,
        routes: [{
            path: '/api',
            authorization: true,
            aliases: {
                "POST /users/login": "users.login",
                "REST /users": "users",
                "GET /user": "users.me",
                "GET /profiles/:username": "users.profile",
            },
            mappingPolicy: 'restrict',
            cors: true,
            bodyParsers: {
                json: {
                    strict: false
                },
                urlencoded: {
                    extended: false
                }
            }
        }],
        onError(req, res, err) {
            // Return with the error as JSON object
            res.setHeader("Content-type", "application/json; charset=utf-8");
            res.writeHead(err.code || 500);

            if (err.code == 422) {
                let o = {};
                err.data.forEach(e => {
                    let field = e.field.split(".").pop();
                    o[field] = e.message;
                });

                res.end(JSON.stringify({ errors: o }, null, 2));
            } else {
                const errObj = _.pick(err, ["name", "message", "code", "type", "data"]);
                res.end(JSON.stringify(errObj, null, 2));
            }
            this.logResponse(req, res, err ? err.ctx : null);
        }
    },
    methods: {
        authorize(ctx, route, req) {
            const token = req.headers.authorization.split(' ')[1];
            return Promise.resolve(token)
                .then(async (token) => {
                    if (token) {
                        try {
                            const user = await ctx.call("users.resolveToken", { token });
                            if (user) {
                                this.logger.info("Authenticated via JWT: ", user.username);
                                ctx.meta.user = _.pick(user, ["_id", "username", "email"]);
                                ctx.meta.token = token;
                            }
                            return user;
                        } catch (err) {
                            return null;
                        }
                    }
                })
                .then((user) => {
                    if (req.$endpoint.action.auth === "required" && !user)
                        return Promise.reject(new UnAuthorizedError());
                });
        }
    }
}