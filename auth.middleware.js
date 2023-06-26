const { MoleculerClientError } = require('moleculer').Errors;
const jwt = require('jsonwebtoken');

module.exports = (options = {}) => {
    return {
        localAction(next) {
            return async function (ctx) {
                console.log('Middleware called');
                console.log(ctx);
                // console.log(ctx.req);
                const authorization = ctx.meta.headers && ctx.meta.headers.authorization;
                if (!authorization || !authorization.startsWith('Bearer ')) {
                    throw new MoleculerClientError('Invalid token', 401, 'INVALID_TOKEN');
                }
                const token = authorization.slice(7);
                try {
                    const decoded = jwt.verify(token, 'super-secret');
                    ctx.meta.user = decoded;
                } catch (err) {
                    throw new MoleculerClientError('Invalid token', 401, 'INVALID_TOKEN');
                }
                return next(ctx);
            };
        },
    };
};
