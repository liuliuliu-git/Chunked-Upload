const express = require("express");
const path = require("path");
const multiparty = require("multiparty");
const fse = require("fs-extra");
const cors = require("cors");
const bodyParser = require("body-parser");

// 临时缓存的目录
const UPLOAD_Dir = path.resolve(__dirname, "uploads");
const extractExt = filename => {
  return path.extname(filename);
}
const app = express();
app.use(cors());
app.use(bodyParser.json());
// 上传接口
app.post("/upload", (req, res) => {
  const form = new multiparty.Form();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(401).json({
        ok: false,
        message: "上传失败"
      })
      return;
    }
    // console.log(fields);
    // console.log(files);
    // 临时缓存目录
    const fileHash = fields["fileHash"][0];
    const chunkHash = fields["chunkHash"][0];

    // 创建文件hash值对应的目录
    const filePath = path.resolve(UPLOAD_Dir, fileHash);
    if (!fse.existsSync(filePath)) {
      await fse.mkdir(filePath);
    }

    // 创建文件块对应的文件
    const oldPath = files["file"][0]["path"]
    const chunkPath = path.resolve(filePath, chunkHash);
    if (!fse.existsSync(chunkPath)) {
      await fse.move(oldPath, chunkPath);
    }


    res.status(200).json({
      ok: true,
      message: "上传成功"
    })

  })

})
// 合并接口
app.post("/merge", async (req, res) => {
  const { fileHash, fileName, size } = req.body;
  // console.log(extractExt(fileName));
  // 如果已经存在该文件，就没有必要去上传
  const filePath = path.resolve(UPLOAD_Dir, fileHash + extractExt(fileName));
  if (fse.existsSync(filePath)) {
    res.status(200).json({
      ok: true,
      message: "文件上传成功"
    })
    return;
  }
  // 如果服务器没有存在该文件，则去拼接文件
  const chunkDir = path.resolve(UPLOAD_Dir, fileHash);
  if (!fse.existsSync(chunkDir)) {
    res.status(401).json({
      ok: false,
      message: "合并失败,请重新上传"
    })
    return;
  }
  const chunkPaths = await fse.readdir(chunkDir);
  // console.log(chunkPaths);
  // 根据切片下标进去排序
  // 否则得到的切片顺序可能回混乱
  chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1]);
  const list = chunkPaths.map((chunkName, index) => {
    return new Promise(async (resolve, reject) => {
      const chunkPath = path.resolve(chunkDir, chunkName);
      const readStream = fse.createReadStream(chunkPath);
      const writeStream = fse.createWriteStream(filePath, {
        start: index * size,
        end: (index + 1) * size
      })
      readStream.on("end", async () => {
        await fse.unlink(chunkPath);
        resolve();
      })
      readStream.pipe(writeStream);
    })

  })
  await Promise.all(list);
  await fse.remove(chunkDir);


  res.status(200).json({
    ok: true,
    message: "合并成功"
  })
})
app.post("/verify", async (req, res) => {
  const { fileHash, fileName } = req.body;
  const filePath = path.resolve(UPLOAD_Dir, fileHash + extractExt(fileName));
  // 返回服务器已经上传的切片信息
  const chunkDir = path.join(UPLOAD_Dir, fileHash);
  let chunkPaths = [];
  if (fse.existsSync(chunkDir)) {
    console.log("续传成功");
    chunkPaths = await fse.readdir(chunkDir);
  }

  // 如果文件已经存在，则直接返回
  if (fse.existsSync(filePath)) {
    res.status(200).json({
      ok: true,
      data: {
        showUpload: false
      }
    })
    return;
  }
  // 如果不存在，则提示需要上传
  res.status(200).json({
    ok: true,
    data: {
      showUpload: true,
      existChunks: chunkPaths
    }
  })

})

app.listen(8090, () => {
  console.log("Server is running on port 8090")
})