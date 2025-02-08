<script setup lang="ts">
import { ref } from "vue";
import SparkMD5 from "spark-md5";
import { CHUNK_SIZE } from "./utils/constraint";
import {getChunkList} from "./utils/chunk";
const fileHashs = ref<string[]>([])
const fileNames = ref<string[]>([])


// 计算hash
const calculateHash = (chunks: Blob[]) => {
  // 采用使用hash值来标识文件，防止重复上传
  // 为了减少上传时间，
  return new Promise((resolve, reject) => {
    const target: Blob[] = [] // 存放参与运算的文件块
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();
    // 1：第一个和最后一个文件块，全部参与运算
    // 2：其他文件块，分别在前面、中间、后面取两个字节参与运算
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
  for (let i = 0; i < fileHashs.value.length; i++) {
    fetch("http://localhost:8090/merge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fileHash: fileHashs.value[i],
        fileName: fileNames.value[i],
        size: CHUNK_SIZE
      })
    }).then((res) => {
      console.log("合并成功");
    })

  }

}
const uploadChunks = async (chunks: Blob[], fileIndex: number) => {
  const data = chunks.map((chunk, index) => {
    return {
      fileHash: fileHashs.value[fileIndex],
      chunkHash: fileHashs.value[fileIndex] + "-" + fileIndex + index,
      fileName: fileNames.value[fileIndex],
      chunk
    }
  })
  const formDatas: FormData[] = data
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
  const max = 10;//并发请求最大数量
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
const verifyHash = async (fileHash: string, fileName: string) => {
  const res = await fetch("http://localhost:8090/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileHash,
      fileName
    })
  });
  const res_1 = await res.json();
  return res_1;

}
const handleUpload = async (e: Event) => {
  // 读取文件
  const fileList = (e.target as HTMLInputElement).files;
  // 如果没有文件，直接返回
  if (!fileList) return;
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    // 设置文件名
    fileNames.value[i] = file.name;
    // 文件分片
    const chunks = [];
    chunks.push(getChunkList(file).blob);
    // 计算hash并保存
    fileHashs.value[i] = await calculateHash(chunks[0]) as string;
    //检验hash
    const data = await verifyHash(fileHashs.value[i], fileNames.value[i]);
    if (!data.data.showUpload) {
      console.log("秒传");
      return
    }
    // 上传切片
    await uploadChunks(chunks[0], i);
  }
}

</script>

<template>
  <div>
    <h1>大文件上传</h1>
    <input type="file" @change="handleUpload" multiple />
  </div>
</template>

<style scoped></style>
