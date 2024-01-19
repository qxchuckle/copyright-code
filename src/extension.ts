import * as vscode from 'vscode';
import findFile from './findFile';
import * as utils from './utils';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	// 命令
	const extractCodeCommand = vscode.commands.registerCommand('copyright-code.extractCode', async () => {
		await extractCode();
	});
	// 中文版命令
	const extractCodeZHCommand = vscode.commands.registerCommand('copyright-code.extractCodeZH', async () => {
		await extractCode();
	});
	// 注册命令
	context.subscriptions.push(extractCodeCommand, extractCodeZHCommand);
}

export function deactivate() { }

// 提取代码
async function extractCode() {
	// 获取当前工作区的根目录
	const rootPath = await utils.getRootPath();
	if (!rootPath) { return; }
	// 获取需要提取的文件
	const filesToExtract = await findFile(rootPath);
	if (!filesToExtract) { return; }
	// 输出文件名
	const outPutFileName = `extractedCode_${new Date().getTime()}.txt`;
	// 提取并写入数据
	await extractAndWriteData(rootPath, filesToExtract, outPutFileName);
}

// 提取并写入数据
async function extractAndWriteData(
	rootPath: string,
	filesToExtract: vscode.Uri[],
	outPutFileName: string = 'extractedCode.txt'
) {
	const outputFilePath = path.join(rootPath, outPutFileName);
	// 内置的需要排除的文件，即使你不选择，它也会被排除
	const excludeFiles = [outPutFileName, 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
	// 创建可写流
	const outputStream = fs.createWriteStream(outputFilePath);
	outputStream.on('finish', () => {
		vscode.window.showInformationMessage(`提取的项目代码已保存至: ${outputFilePath}`);
	});
	// 写入数据
	await utils.writeDataFromFileArray(outputStream, filesToExtract, 0, async (file) => {
		// 打开文档
		const doc = await vscode.workspace.openTextDocument(file);
		if (excludeFiles.includes(path.basename(doc.fileName))) { return ''; }
		// 删除注释和空行
		return utils.deleteCommentsAndBlankLines(doc.getText());
	});
}
