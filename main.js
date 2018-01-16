const fs = require('fs')
const path = require('path')
const Koa = require('koa')
const Router = require('koa-router')
const serve = require("koa-static")
const multer = require('koa-multer')
const {createClient} = require('then-redis')
const cors = require('koa-cors')
const bodyParser = require('koa-bodyparser')
const images = require('images')

const redisConfig = {
    host: 'localhost',
    port: 6379,
    password: 'Byte20171116@'
}

if(!fs.existsSync('../uploads')){
    fs.mkdir('../uploads',0777)
}

const app = new Koa()

app.use(cors());

app.use(serve(__dirname + "/public", {
    extensions: ['html','js','css','jpg','jpeg','png']
}))

app.use(serve(path.join(__dirname , "../uploads"), {
    extensions: ['jpg', 'jpeg', 'png']
}))

app.use(bodyParser())

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '../uploads')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' +Math.round(Math.random() * 1000000) + path.extname(file.originalname))
    }
})
const upload = multer({
    storage: storage
});

var router = new Router()

router.get('/', ctx => {
    console.log('get /')
    ctx.redirect('/index.html')
})

router.options('/faces/upload', ctx => {
    ctx.body=""
})

router.post('/faces/upload', upload.single('facefile'), async ctx => {
    if (!('file' in ctx.req && 'filename' in ctx.req.file)) {
        ctx.body = {
            status: -1,
            msg: '请上传图片'
        }
        return
    }

    filename = ctx.req.file.filename
    extname = path.extname(filename)
    console.log("upload", filename)

    Array.prototype.contains = function (v) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == v) {
                return true
            }
        }
        return false;
    }

    if (!['.jpg', '.jpeg', '.png'].contains(extname.toLowerCase())) {
        ctx.body = {
            status: -2,
            msg: 'Unsuported image type. Only jpg/jpeg/png suported by for now.'
        }
        return
    }

    fpath = path.join('../uploads', filename)
    img = images(fpath)
    size = img.size()
    width = size['width']
    height = size['height']
    minwh = Math.min(width, height)
    factor = 1
    while(minwh > 1000){
        minwh  = minwh / 2
        factor = factor * 2
    }
    // console.log('factor', factor)
    img.resize(width/factor, height/factor).save(fpath, {
        quality: 100 
    });

    ctx.body = {
        status: 0,
        msg:'success',
        imgFile: filename,
    }
})

router.get('/faces/compare', async ctx => {
    // console.log('compare', ctx.query, 'imgFile1' in ctx.query)

    if (!(('imgFile1' in ctx.query) && ('imgFile2' in ctx.query))) {
        ctx.body = {
            status: -1,
            msg: '请提交两张图片'
        }
        return
    }

    filename1 = ctx.query.imgFile1
    extname1 = path.extname(filename1)
    // console.log(filename1, extname1)

    filename2 = ctx.query.imgFile2
    extname2 = path.extname(filename2)
    console.log(filename1, filename2)

    Array.prototype.contains = function (v) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == v) {
                return true
            }
        }
        return false;
    }

    if (!['.jpg', '.jpeg', '.png'].contains(extname1.toLowerCase()) || !['.jpg', '.jpeg', '.png'].contains(extname2.toLowerCase())) {
        ctx.body = {
            status: -2,
            msg: 'Unsuported image type. Only jpg/jpeg/png suported by for now.'
        }
        return
    }

    client = createClient(redisConfig)
    client.expire('face_compare', 10)
    filename = filename1 + '#' + filename2 + '#0.92'
    console.log('filename: ', filename)
    client.lpush('face_compare', filename)
    ret = await client.brpop(filename, 60)
    console.log("face compare result", ret)
    if (ret == null) {
        ret = {
            status: -3,
            msg: 'message queue failed'
        }
        ctx.body = ret
        return
    }

    ctx.body = ret[1]
})

router.get('/faces/detect', async ctx => {
    if (!('imgFile' in ctx.query)) {
        ctx.body = {
            status: -1,
            msg: '请先上传图片'
        }
        return
    }

    // console.log(ctx.req.body.jsonorimage)
    filename = ctx.query.imgFile
    extname = path.extname(filename)
    console.log(filename, extname)
    Array.prototype.contains = function (v) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == v) {
                return true
            }
        }
        return false;
    }
    if (!['.jpg', '.jpeg', '.png'].contains(extname.toLowerCase())) {
        ctx.body = {
            status: -1,
            msg: 'Unsuported image type. Only jpg/jpeg/png suported by for now.'
        }
        return
    }

    client = createClient(redisConfig)
    client.expire('face_detect', 10)
    client.lpush('face_detect', filename)
    ret = await client.brpop(filename, 20)
    console.log("face detect result", ret)
    if (ret == null) {
        ret = {
            status: -2,
            msg: 'message queue failed'
        }
        ctx.body = ret
        return
    }

    ret = JSON.parse(ret[1])

    if (ret.status != 0 || ret.faces.length == 0) {
        ctx.body = ret
        return
    }

    ctx.body = ret
  
})

router.post('/faces/detect',upload.single('facefile'), async ctx =>{
    // console.log(ctx.req.body.jsonorimage)
    filename = ctx.req.file.filename
    extname = path.extname(filename)
    console.log(filename, extname)
    Array.prototype.contains = function (v) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == v) {
                return true
            }
        }
        return false;
    }
    if (!['.jpg', '.jpeg', '.png'].contains(extname.toLowerCase())){
        ctx.body = {
            status: -1,
            msg: 'Unsuported image type. Only jpg/jpeg/png suported by for now.'
        }
        return
    }

    client = createClient(redisConfig)
    client.expire('face_detect', 10)
    client.lpush('face_detect', filename)
    ret = await client.brpop(filename, 20)
    console.log("face detect result", ret)
    if(ret == null){
        ret = { status: -2, msg: 'message queue failed'}
        ctx.body = ret
        return
    }
    
    ret = JSON.parse(ret[1])

    if(ret.status != 0 || ret.faces.length==0){
        ctx.body = ret
        return
    }

    // if (ctx.req.body.jsonorimage == '2') {//image
        // labeled = '/' + path.basename(filename, extname) + '_labeled' + extname
        ctx.redirect(ret.detectUrl)
    // }else{//json
    //     ctx.body = ret    
    // }    
})

router.get('/plates/recog', async ctx => {
    if (!('imgFile' in ctx.query)) {
        ctx.body = {
            status: -1,
            msg: '请先上传图片'
        }
        return
    }

    // console.log(ctx.req.body.jsonorimage)
    filename = ctx.query.imgFile
    extname = path.extname(filename)
    console.log(filename, extname)
    Array.prototype.contains = function (v) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == v) {
                return true
            }
        }
        return false;
    }
    if (!['.jpg', '.jpeg', '.png'].contains(extname.toLowerCase())) {
        ctx.body = {
            status: -1,
            msg: 'Unsuported image type. Only jpg/jpeg/png suported by for now.'
        }
        return
    }

    client = createClient(redisConfig)
    client.expire('plate_recog', 10)
    client.lpush('plate_recog', filename)
    ret = await client.brpop(filename, 20)
    console.log("plate recog result", ret)
    if (ret == null) {
        ret = {
            status: -2,
            msg: 'message queue failed'
        }
        ctx.body = ret
        return
    }

    ret = JSON.parse(ret[1])
    ctx.body = ret
})


app.use(router.routes())

app.listen(8100)