<script setup lang="ts">
import { ref } from "vue";
import SparkMD5 from "spark-md5";
const CHUNK_SIZE = 1024 * 1024;
const fileHash = ref<string>("")
const fileName = ref<string>("")
// 获取文件块(文件的slice方法)
const getChunkList = (file: File) => {
  let current = 0;
  const blob = [];
  // 切割成块
  while (current < file.size) {
    blob.push(file.slice(current, current + CHUNK_SIZE));
    current += CHUNK_SIZE;
  }
  // console.log(chunkList);
  return blob

}
// 计算hash
const calculateHash = (chunks: Blob[]) => {
  // 采用使用hash值来标识文件，防止重复上传
  // 为了减少上传时间，
  // 1：第一个和最后一个文件块，全部参与运算
  // 2：其他文件块，分别在前面、中间、后面取两个字节参与运算

  return new Promise((resolve, reject) => {
    const target: Blob[] = [] // 存放参与运算的文件块
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();
    chunks.forEach((chunk, index) => {
      if (index === 0 || index === chunks.length - 1) {
        target.push(chunk);
      }
      else {
        target.push(chunk.slice(0, 2));
        target.push(chunk.slice(CHUNK_SIZE / 2, CHUNK_SIZE / 2 + 2));
        target.push(chunk.slice(CHUNK_SIZE - 2, CHUNK_SIZE));
      }
    })
    fileReader.readAsArrayBuffer(new Blob(target));
    // 异步
    fileReader.onload = (e) => {
      spark.append((e.target as FileReader).result);
      // console.log("hash:"+spark.end());
      resolve(spark.end())


    }
  })
}

const mergeRequest = () => {
  fetch("http://localhost:8090/merge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileHash: fileHash.value,
      fileName: fileName.value,
      size: CHUNK_SIZE
    })
  }).then((res) => {
    console.log("合并成功");

  })
}
const uploadChunks = async (chunks: Blob[], existChunks: string[]) => {
  const data = chunks.map((chunk, index) => {
    return {
      fileHash: fileHash.value,
      chunkHash: fileHash.value + "-" + index,
      fileName: fileName.value,
      chunk
    }
  })
  const formDatas: FormData[] = data
    .filter(item => !existChunks.includes(item.chunkHash))
    .map(item => {
      const formdata = new FormData();
      formdata.append("file", item.chunk);
      formdata.append("fileHash", item.fileHash);
      formdata.append("chunkHash", item.chunkHash);
      formdata.append("fileName", item.fileName);
      return formdata
    })
  // console.log(formDatas);
  let index = 0;
  const max = 6;//并发请求最大数量
  const taskPool = [];// 请求池
  while (index < formDatas.length) {
    const task = fetch("http://localhost:8090/upload", {
      method: "POST",
      body: formDatas[index]
    })
    taskPool.splice(taskPool.findIndex(item => item === task), 1)
    taskPool.push(task);
    if (taskPool.length === max) {
      await Promise.race(taskPool);
    }
    index++;
  }
  await Promise.all(taskPool);
  // 通知服务区合并文件
  mergeRequest();

}
const verifyHash = async () => {
  const res = await fetch("http://localhost:8090/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileHash: fileHash.value,
      fileName: fileName.value
    })
  });
  const res_1 = await res.json();
  return res_1;

}
const handleUpload = async (e: Event) => {
  // console.log((e.target as HTMLInputElement).files);
  // 读取文件
  const fileList = (e.target as HTMLInputElement).files;
  // console.log(fileList);
  // 如果没有文件，直接返回
  if (!fileList) return;
  const file = fileList[0];
  // console.log(fileList[0] as File);

  fileName.value = fileList[0]["name"];
  // 文件分片
  const chunks = getChunkList(file);
  // hash计算
  fileHash.value = await calculateHash(chunks) as string;
  // console.log("hash:"+hash);
  //检验hash
  const data = await verifyHash();

  if (!data.data.showUpload) {
    console.log("秒传");
    return
  }
  // 上传分片
  await uploadChunks(chunks, data.data.existChunks);

}

</script>

<template>
  <div>
    <h1>大文件上传</h1>
    <input type="file" @change="handleUpload" multiple/>
  </div>
</template>

<style scoped></style>
