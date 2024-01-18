import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';

// 获取当前工作区的根目录
export async function getRootPath() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('没有打开的工作区');
    return false;
  }
  if (workspaceFolders.length > 1) {
    const folderNames = workspaceFolders.map(folder => folder.name);
    const selectedFolder = await vscode.window.showQuickPick(folderNames, {
      placeHolder: '选择当前工作区其中一个根文件夹'
    });
    if (selectedFolder) {
      const selectedWorkspaceFolder = workspaceFolders.find(folder => folder.name === selectedFolder);
      if (selectedWorkspaceFolder) {
        const selectedPath = vscode.Uri.joinPath(selectedWorkspaceFolder.uri, '').fsPath;
        return selectedPath;
      }
    }
    return false;
  }
  return vscode.Uri.joinPath(workspaceFolders[0].uri, '').fsPath;
}

// 删除注释和空行
export function deleteCommentsAndBlankLines(content: string) {
  return content.replace(/\/\/.*|\/\*[\s\S]*?\*\/|^\s*$/gm, '')
    .replace(/(\n[\s\t]*\r*\n)/g, '\n')
    .replace(/^[\n\r\n\t]*|[\n\r\n\t]*$/g, '');
}

// 递归写入数据的函数
export async function writeDataFromFileArray(
  writableStream: fs.WriteStream,
  fileArray: Array<Object>,
  index: number,
  getContent: (obj: Object) => Promise<string>
) {
  if (index < fileArray.length) {
    // 获取当前数据
    const currentData = await getContent(fileArray[index]);
    // 尝试写入数据
    if (currentData && !writableStream.write(currentData + os.EOL)) {
      // 在 drain 事件触发后继续写入下一条数据
      writableStream.once('drain', () => {
        writeDataFromFileArray(writableStream, fileArray, index + 1, getContent);
      });
    } else {
      // 数据已经完全写入，递归调用写入下一条数据
      writeDataFromFileArray(writableStream, fileArray, index + 1, getContent);
    }
  } else {
    // 所有数据都已写入，结束可写流
    writableStream.end();
  }
}

// 获取项目中所有文件的后缀列表
export async function getAllFileExtensions(rootPath: string): Promise<string[]> {
  const allFileExtensions: string[] = [];
  const files = await vscode.workspace.findFiles('**/*');
  files.forEach((file) => {
    const ext = path.extname(file.fsPath);
    if (ext) {
      const fileExt = ext.slice(1); // remove the leading dot
      if (!allFileExtensions.includes(fileExt)) {
        allFileExtensions.push(fileExt);
      }
    }
  });
  return allFileExtensions;
}

// 获取按深度排序的目录列表
export async function getDirectoriesSortedByDepth(rootPath: string): Promise<string[]> {
  const directories: string[] = [];
  const fileSystemEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(rootPath));

  for (const [name, type] of fileSystemEntries) {
    if (type === vscode.FileType.Directory) {
      directories.push(name);
      const subdirectories = await getDirectoriesSortedByDepth(path.join(rootPath, name));
      directories.push(...subdirectories.map(subdir => path.join(name, subdir)));
    }
  }

  return directories;
}
