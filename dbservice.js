const DbService = require('moleculer-db')
const MongooseAdapter = require('moleculer-db-adapter-mongoose')
const mongoose = require('mongoose');

module.exports = function (collection, schemaPassed) {
    const adapter = new MongooseAdapter('mongodb://localhost:27017/moleculer');
    const schema = {
        mixins: [DbService],
        // adapter: new MongooseAdapter('mongodb://localhost:27017/moleculer'),
        adapter,
        model: mongoose.model(collection, schemaPassed),
        methods: {
            // methods go here in case we want to add some common functionality
        },
    }
    schema.collection = collection;
    return schema;
}