const { Level } = require('level')
const path = require('path')

let db

async function get(key) {
    try {
        let value = await db.get(key)
        if (value) {
            return JSON.parse(value)
        }
    } catch (error) {
        if (error.code != 'LEVEL_NOT_FOUND') {
            throw error
        }
    }
}
async function put(key, value) {
    const text = JSON.stringify(value)
    return await db.put(key, text)
}
async function all() {
    return await db.keys().all()
}
function init(uploadPath) {
    db = new Level(path.join(uploadPath, 'sign-mapping-db'))
}

module.exports = {
    init,
    get,
    put,
    all
}
