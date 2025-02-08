import { CHUNK_SIZE } from './constraint'

// 获取文件块(文件的slice方法)
export const getChunkList = (file: File) => {
  let current = 0;
  const blob = [];
  // 切割成块
  while (current < file.size) {
    blob.push(file.slice(current, current + CHUNK_SIZE));
    current += CHUNK_SIZE;
  }

  return { blob };

}
