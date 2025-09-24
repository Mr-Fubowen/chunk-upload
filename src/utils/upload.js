const fs = require('fs-extra')
const path = require('path')
const db = require('./db')

function appendTimeToPath(name) {
    const date = new Date()
    const yy = date.getFullYear().toString()
    const MM = String(date.getMonth() + 1).padStart(2, '0')
    const dd = date.getDate().toString().padStart(2, '0')
    return path.join(yy, MM, dd, name)
}

async function merge(chunkList, target) {
    if (await fs.exists(target)) {
        return target
    }
    const target_path = path.dirname(target)
    await fs.ensureDir(target_path)
    await new Promise(async (resolve, reject) => {
        const input = fs.createWriteStream(target, { flags: 'a' })
        let length = chunkList.length
        function appendChunk() {
            if (chunkList.length > 0) {
                const chunk = chunkList.pop()
                const output = fs.createReadStream(chunk)
                output.pipe(input, { end: false })
                output.on('end', () => {
                    length--
                    if (length == 0) {
                        input.end()
                        resolve()
                    } else {
                        appendChunk()
                    }
                })
                output.on('error', reject)
            }
        }
        appendChunk()
    })
}

async function mergeChunks({ tempPath, savePath, name, id }) {
    let timePath = appendTimeToPath(name)
    let saveRootPath = path.join(savePath, timePath)
    if (await fs.pathExists(saveRootPath)) {
        const ext = path.extname(name)
        const uniqueName = path.basename(name, ext) + '_' + id + ext
        timePath = appendTimeToPath(uniqueName)
        saveRootPath = path.join(savePath, timePath)
    }
    const chunks = await fs.readdir(tempPath)
    const paths = chunks.sort((a, b) => a - b).map(it => path.join(tempPath, it))
    await merge(paths, saveRootPath)
    await fs.remove(tempPath)
    return timePath
}

async function uploadChunk({ tempPath, savePath, name, id, chunk, total, index, size, prefix }) {
    let model = await db.get(id) || {
        id,
        status: 'WATING',
        chunks: []
    }
    if (model.status == 'SUCCESS') {
        return {
            status: 'SUCCESS',
            data: model.path
        }
    }
    const temp = path.join(tempPath, id + '_' + size)
    const tempChunkPath = path.join(temp, index)
    await fs.pathExists(tempChunkPath) || await fs.move(chunk.path, tempChunkPath)
    model.chunks.push(index)
    if (total == model.chunks.length) {
        let target = await mergeChunks({
            tempPath: temp,
            name,
            id,
            savePath
        })
        model.status = 'SUCCESS'
        model.path = path.join(prefix, target)
    }
    await db.put(id, model)
    return model
}

async function saveText({ savePath, text, name, id, prefix }) {
    let timePath = appendTimeToPath(name)
    let saveRootPath = path.join(savePath, timePath)
    if (await fs.pathExists(saveRootPath)) {
        const ext = path.extname(name)
        const uniqueName = path.basename(name, ext) + '_' + id + ext
        timePath = appendTimeToPath(uniqueName)
        saveRootPath = path.join(savePath, timePath)
    }
    await fs.outputFile(saveRootPath, text)
    return path.join(prefix, timePath)
}

module.exports = {
    uploadChunk,
    saveText
}
