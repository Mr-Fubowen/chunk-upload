const fs = require('fs-extra')
const multiparty = require('multiparty')
const db = require('./db')
const url = require('url')
const path = require('path')
const { uploadChunk, saveText } = require('./upload')


let tempPath
let uploadPath

function parseForm(request) {
    return new Promise((resolve, reject) => {
        const form = new multiparty.Form()
        form.parse(request, (error, fields, files) => {
            if (error) {
                reject(error)
            } else {
                try {
                    const data = {}
                    for (const key in fields) {
                        data[key] = fields[key][0]
                    }
                    for (const key in files) {
                        data[key] = files[key][0]
                    }
                    resolve(data)
                } catch (error) {
                    reject(error)
                }
            }
        })
    })
}
async function uploadCheck(request) {
    let { query: { id } } = url.parse(request.url, true)
    let item = await db.get(id)
    if (item) {
        return item
    }
    return {
        id,
        status: "WAITING",
        chunks: []
    }
}
async function appendChunk(request) {
    const params = await parseForm(request)
    return await uploadChunk({
        ...params,
        prefix: '/upload',
        savePath: uploadPath,
        tempPath: tempPath,
    })
}
const endpoint = {
    '/upload/check': uploadCheck,
    '/upload': appendChunk
}
function upload(options = {}) {
    tempPath = options.tempPath
    uploadPath = path.join(options.uploadPath, 'upload')
    fs.ensureDirSync(tempPath)
    fs.ensureDirSync(uploadPath)
    db.init(uploadPath)
    return async (ctx, next) => {
        let handle = endpoint[ctx.path]
        if (handle) {
            let response
            try {
                response = {
                    status: 'SUCCESS',
                    data: await handle(ctx.req)
                }
            } catch (error) {
                response = {
                    status: 'ERROR',
                    msg: error.message
                }
            }
            ctx.body = response
        }
        else {
            await next()
        }
    }
}

async function save(text, name, id) {
    return await saveText({
        text,
        name,
        id,
        prefix: '/upload',
        savePath: uploadPath,
    })
}

module.exports = {
    upload,
    save
}

