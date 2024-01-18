import * as vscode from 'vscode';
import * as utils from './utils';

// 选择需要提取的文件的后缀名
async function selectFileExtensions(rootPath: string, skipDirectories: (string | RegExp)[] = []) {
	// 获取项目中所有文件的后缀列表
	const allFileExtensions = await utils.getAllFileExtensions(rootPath, skipDirectories);
	// 让用户选择需要提取的文件后缀名
	const selectedExtensions = await vscode.window.showQuickPick(allFileExtensions, {
		canPickMany: true,
		placeHolder: '请选择需要提取的文件的后缀'
	});
	return selectedExtensions || [];
}

// 选择需要排除的目录
async function selectExcludeDirs(rootPath: string, skipDirectories: (string | RegExp)[] = []) {
	// 获取并排序目录列表
	const allDirectories = await utils.getDirectoriesSortedByDepth(rootPath, skipDirectories);
	// 让用户选择需要排除的目录
	const selectedDirs = await vscode.window.showQuickPick(allDirectories, {
		canPickMany: true,
		placeHolder: '请选择需要排除的目录'
	});
	return selectedDirs || [];
}

// 用户选择匹配规则并获取Pattern
async function getPattern(rootPath: string) {
	const skipDirectories = ['node_modules', /^\./];
	const stringSkipDirectories = skipDirectories.filter(item => typeof item === 'string');
	// 让用户选择需要提取的文件后缀名
	const selectedExtensions = await selectFileExtensions(rootPath, skipDirectories);
	if (!selectedExtensions || selectedExtensions.length === 0) {
		vscode.window.showErrorMessage('没有选择任何后缀');
		return false;
	}
	// 将用户选择的后缀转换为 glob 模式的字符串
	const includeExtensions = selectedExtensions.map(ext => `**/*.${ext}`).join(',');
	// 让用户选择需要排除的目录
	const excludeDirs = await selectExcludeDirs(rootPath, skipDirectories);
	// 创建 glob 模式
	const includePattern = new vscode.RelativePattern(rootPath, `{${includeExtensions}}`);
	const excludePattern = new vscode.RelativePattern(rootPath, `**/{${excludeDirs.join(',')},${stringSkipDirectories.join(',')},.*}/**`);
	return { includePattern, excludePattern };
}

// 根据Pattern查找匹配的文件
export default async function findFilesByPattern(rootPath: string) {
	// 获取Pattern
	const pattern = await getPattern(rootPath);
	if (!pattern) { return; }
	// 查找匹配的文件
	const filesToExtract = await vscode.workspace.findFiles(pattern.includePattern, pattern.excludePattern);
	if (filesToExtract.length === 0) {
		vscode.window.showInformationMessage("没有匹配的文件");
		return false;
	}
	return filesToExtract;
}