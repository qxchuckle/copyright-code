import * as vscode from 'vscode';
import findFile from './findFile';
import * as utils from './utils';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('copyright-code.extractCode', async () => {
		// 获取当前工作区的根目录
		const rootPath = await utils.getRootPath();
		if (!rootPath) { return; }
		// 获取需要提取的文件
		const filesToExtract = await findFile(rootPath);
		if (!filesToExtract) { return; }
		// 提取并写入数据
		await extractAndWriteData(rootPath, filesToExtract);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }

// 提取并写入数据
async function extractAndWriteData(rootPath: string, filesToExtract: vscode.Uri[]) {
	// 输出的文件名
	const outPutFileName = 'extractedCode.txt';
	const outputFilePath = path.join(rootPath, outPutFileName);
	// 内置的需要排除的文件，应该没人会想提取这些文件吧
	const excludeFiles = [outPutFileName, 'package.json', 'package-lock.json'];
	// 创建可写流
	const outputStream = fs.createWriteStream(outputFilePath);
	// 写入数据
	await utils.writeDataFromFileArray(outputStream, filesToExtract, 0, async (file) => {
		// 打开文档
		const doc = await vscode.workspace.openTextDocument(file);
		if (excludeFiles.includes(path.basename(doc.fileName))) { return ''; }
		// 删除注释和空行
		return utils.deleteCommentsAndBlankLines(doc.getText());
	});
	outputStream.on('finish', () => {
		vscode.window.showInformationMessage(`提取的项目代码已保存至: ${outputFilePath}`);
	});
}
