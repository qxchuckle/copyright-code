import * as os from "os";
import * as fs from "fs";
import * as vscode from "vscode";
import * as path from "path";
import { isBinary } from "istextorbinary";

// 获取当前工作区的根目录
export async function getRootPath() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("没有打开的工作区");
    return false;
  }
  if (workspaceFolders.length > 1) {
    const folderNames = workspaceFolders.map((folder) => folder.name);
    const selectedFolder = await vscode.window.showQuickPick(folderNames, {
      placeHolder: "选择当前工作区其中一个根文件夹",
    });
    if (selectedFolder) {
      const selectedWorkspaceFolder = workspaceFolders.find(
        (folder) => folder.name === selectedFolder
      );
      if (selectedWorkspaceFolder) {
        const selectedPath = vscode.Uri.joinPath(
          selectedWorkspaceFolder.uri,
          ""
        ).fsPath;
        return selectedPath;
      }
    }
    return false;
  }
  return vscode.Uri.joinPath(workspaceFolders[0].uri, "").fsPath;
}

// 删除注释和空行
export function deleteCommentsAndBlankLines(
  content: string,
  type: vscode.TextDocument["languageId"]
): string {
  if (type === "plaintext" || type === "json") {
    return content
      .replace(/\n\s*\n/g, "\n") // 删除多余的空行
      .trim(); // 删除开头和结尾的空行;
  }
  if (!content) {
    return "";
  }

  let commentRegex: RegExp;

  switch (type) {
    case "javascript":
    case "typescript":
    case "java":
    case "c":
    case "cpp":
      commentRegex =
        /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\/\/.*|\/\*[\s\S]*?\*\//gm;
      break;
    case "python":
      commentRegex = /#.*|'''[\s\S]*?'''|"""[\s\S]*?"""/gm;
      break;
    case "html":
    case "xml":
      commentRegex = /<!--[\s\S]*?-->/gm;
      break;
    case "css":
      commentRegex = /\/\*[\s\S]*?\*\//gm;
      break;
    case "shellscript":
    case "perl":
    case "ruby":
      commentRegex =
        /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|#.*|=begin[\s\S]*?=end/gm;
      break;
    default:
      commentRegex =
        /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\/\/.*|\/\*[\s\S]*?\*\//gm; // 默认处理方式
  }

  switch (type) {
    case "python":
    case "html":
    case "xml":
    case "css":
      return content
        .replace(commentRegex, "")
        .replace(/\n\s*\n/g, "\n") // 删除多余的空行
        .trim(); // 删除开头和结尾的空行
    default:
  }

  return content
    .replace(commentRegex, (match, p1) => (p1 ? p1 : ""))
    .replace(/\n\s*\n/g, "\n") // 删除多余的空行
    .trim(); // 删除开头和结尾的空行
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
      writableStream.once("drain", () => {
        writeDataFromFileArray(
          writableStream,
          fileArray,
          index + 1,
          getContent
        );
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
export async function getAllFileExtensions(
  rootPath: string,
  skipDirectories: (string | RegExp)[] = []
): Promise<string[]> {
  const allFileExtensions = new Set<string>();
  const files = await vscode.workspace.findFiles("**/*");
  await Promise.all(
    files.map(async (file) => {
      const filePath = file.fsPath;
      // 如果是二进制文件，跳过，如图片、视频等
      if (isBinary(filePath)) {
        return;
      }
      if (!shouldSkipDirectory(rootPath, filePath, skipDirectories)) {
        const ext = path.extname(filePath);
        if (ext) {
          const fileExt = ext.slice(1);
          if (!allFileExtensions.has(fileExt)) {
            allFileExtensions.add(fileExt);
          }
        }
      }
    })
  );
  return Array.from(allFileExtensions);
}

// 是否是需要跳过的目录
function shouldSkipDirectory(
  rootPath: string,
  filePath: string,
  skipDirectories: (string | RegExp)[] = []
): boolean {
  const relativePath = path.relative(rootPath, filePath);
  const parts = relativePath.split(path.sep);
  return parts.some((part) => shouldSkipItem(part, skipDirectories));
}

// 获取按深度排序的目录列表
export async function getDirectoriesSortedByDepth(
  rootPath: string,
  skipDirectories: (string | RegExp)[],
  fileExtensions: string[]
): Promise<string[]> {
  const directories: string[] = [];
  const fileSystemEntries = await vscode.workspace.fs.readDirectory(
    vscode.Uri.file(rootPath)
  );
  await Promise.all(
    fileSystemEntries.map(async ([name, type]) => {
      if (
        type === vscode.FileType.Directory &&
        !shouldSkipItem(name, skipDirectories)
      ) {
        const subdirectoryPath = path.join(rootPath, name);
        const hasMatchingFiles = await directoryHasMatchingFiles(
          subdirectoryPath,
          fileExtensions
        );
        if (hasMatchingFiles) {
          directories.push(name);
        }
        const subdirectories = await getDirectoriesSortedByDepth(
          subdirectoryPath,
          skipDirectories,
          fileExtensions
        );
        directories.push(
          ...subdirectories.map((subdir) => path.join(name, subdir))
        );
      }
    })
  );
  return directories;
}

// 目录中是否有匹配的后缀的文件
async function directoryHasMatchingFiles(
  directoryPath: string,
  fileExtensions: string[]
): Promise<boolean> {
  const fileSystemEntries = await vscode.workspace.fs.readDirectory(
    vscode.Uri.file(directoryPath)
  );
  const promises = fileSystemEntries.map(async ([name, type]) => {
    if (type === vscode.FileType.File) {
      const extension = path.extname(name).slice(1);
      return fileExtensions.includes(extension);
    }
    return false;
  });
  const results = await Promise.all(promises);
  return results.some((result) => result);
}

// 是否应该跳过该项
function shouldSkipItem(
  item: string,
  skipDirectories: (string | RegExp)[]
): boolean {
  return skipDirectories.some((skipItem) => {
    if (skipItem instanceof RegExp) {
      return skipItem.test(item);
    } else {
      return typeof skipItem === "string" && item === skipItem;
    }
  });
}
