"use strict";

const { MoleculerClientError } = require('moleculer').Errors;
const bcrypt = require('bcrypt');
const jsonwebtoken = require('jsonwebtoken');
const DbConnection = require('./dbservice');
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: Boolean
})

module.exports = {
    name: 'auth',
    mixins: [DbConnection('users', UserSchema)],
    settings: {
        JWT_SECRET: 'super-secret',
        fields: ['_id', 'username', 'email'],
        entityValidator: {
            username: { type: 'string', min: 2 },
            password: { type: 'string', min: 6 },
            email: { type: 'email' }
        }
    },
    actions: {
        create: {
            params: {
                user: { type: 'object' }
            },
            handler: async (ctx) => {
                const entity = ctx.params.user;
                try {
                    await validateEntity(entity);
                    if (entity.username) {
                        const foundUser = await this.adapter.findOne({ username: entity.username });
                        if (foundUser) {
                            throw new MoleculerClientError("Username already exists!", 422, "", [{ field: "username", message: "already exists" },]);
                        }
                    }
                    if (entity.email) {
                        const foundUser = await this.adapter.findOne({ email: entity.email });
                        if (foundUser) {
                            throw new MoleculerClientError("Email already exists!", 422, "", [{ field: "email", message: "already exists" },]);
                        }
                    }
                    entity.password = bcrypt.hashSync(entity.password, 10);
                    const insertedDoc = await this.adapter.insert(entity);
                    const transformedDoc = await this.transformDocuments(ctx, {}, insertedDoc);
                    const user = await this.transformEntity(transformedDoc, true, ctx.meta.token)
                    const json = await this.entityChanged('created', user, ctx);
                    return json;
                } catch (err) {
                    throw err;
                }
            }
        },
        login: {
            params: {
                user: {
                    type: 'object',
                    props: {
                        email: { type: 'email' },
                        password: {
                            type: 'string',
                            min: 1
                        }
                    }
                }
            },
            handler: async (ctx) => {
                const { email, password } = ctx.params.user;
                try {
                    const user = await this.adapter.findOne({ email });
                    if (!user) {
                        throw new MoleculerClientError('Email or password is invalid!', 422, '', [{ field: 'email', message: 'not found' }]);
                    }
                    const passwordMatch = await bcrypt.compare(password, user.password);
                    if (!passwordMatch) {
                        throw new MoleculerClientError('Email or password is invalid!', 422, '', [{ field: 'password', message: 'wrong' }]);
                    }
                    const transformedUser = await this.transformDocuments(ctx, {}, user);
                    return this.transformEntity(transformedUser, true, ctx.meta.token);
                } catch (err) {
                    if (err instanceof MoleculerClientError) {
                        throw err;
                    }
                }
                throw new MoleculerClientError('Login failed!', 500, '', [{ field: 'general', message: 'login failed' }]);
            }
        },
        resolveToken: {
            cache: {
                keys: ['token'],
                ttl: 60 * 30
            },
            params: {
                token: 'string'
            },
            handler: async (ctx) => {
                try {
                    const decoded = await new Promise((resolve, reject) => {
                        jsonwebtoken.verify(ctx.params.token, this.settings.JWT_SECRET, (err, decoded) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(decoded);
                            }
                        });
                    });
                    if (decoded.id) {
                        return this.getById(decoded.id);
                    }
                } catch (err) {
                    throw new Error("Failed to resolve token: " + err.message);
                }
            }
        },
        me: {
            auth: 'required',
            cache: {
                keys: ['#token']
            },
            handler: async (ctx) => {
                try {
                    const user = await this.getById(ctx.meta.user._id);
                    if (!user) {
                        throw new MoleculerClientError("User not found!", 400);
                    }
                    const transformedUser = await this.transformDocuments(ctx, {}, user);
                    const transformedEntity = await this.transformEntity(transformedUser, true, ctx.meta.token);
                    return transformedEntity;
                } catch (err) {
                    throw new MoleculerClientError(err.message, 400);
                }
            }
        }
    },
    methods: {
        generateJWT(user) {
            const today = new Date();
            const exp = new Date(today);
            exp.setDate(today.getDate() + 14);
            return jsonwebtoken.sign({
                id: user._id,
                username: user.username,
                exp: Math.floor(exp.getTime() / 1000)
            }, this.settings.JWT_SECRET);
        },
        transformEntity(user, withToken, token) {
            if (user && withToken) {
                user.token = token || this.generateJWT(user);
            }
            return { user };
        }
    }
}