import * as vscode from 'vscode';
import * as path from 'path';
import * as utils from './utils';

// 选择需要提取的文件的后缀名
async function selectFileExtensions(rootPath: string, skipDirectories: (string | RegExp)[] = []) {
	// 获取项目中所有文件的后缀列表
	const allFileExtensions = await utils.getAllFileExtensions(rootPath, skipDirectories);
	// 让用户选择需要提取的文件后缀名
	const selectedExtensions = await vscode.window.showQuickPick(allFileExtensions, {
		canPickMany: true,
		title: '选择需要提取的文件的后缀',
		placeHolder: '请选择需要提取的文件的后缀'
	});
	return selectedExtensions || [];
}

// 选择需要排除的目录
async function selectExcludeDirs(rootPath: string, skipDirectories: (string | RegExp)[] = [], fileExtensions: string[]) {
	// 获取并排序目录列表
	const allDirectories = await utils.getDirectoriesSortedByDepth(rootPath, skipDirectories, fileExtensions);
	// 让用户选择需要排除的目录
	const selectedDirs = await vscode.window.showQuickPick(allDirectories, {
		canPickMany: true,
		title: '选择需要排除的目录',
		placeHolder: '请选择需要排除的目录'
	});
	return selectedDirs || [];
}

// 选择需要排除的根目录文件
async function selectedRootPathFiles(rootPath: string, fileExtensions: string[], builtInExcludeFiles: string[]): Promise<string[] | undefined> {
	const includePattern = new vscode.RelativePattern(rootPath, `*.{${fileExtensions.join(',')}}}`);
	const excludePattern = new vscode.RelativePattern(rootPath, `{${builtInExcludeFiles.map(item => `**/${item}`).join(',')}}`);
	// 读取根目录下的所有文件
	const files = await vscode.workspace.findFiles(includePattern, excludePattern);
	// 提取文件名
	const fileNames = files.map(file => path.basename(file.path));
	// 让用户选择需要的文件
	const selectedFiles = await vscode.window.showQuickPick(fileNames, {
		canPickMany: true,
		title: '选择需要排除的根目录文件',
		placeHolder: '请选择需要排除的根目录文件',
	});
	return selectedFiles;
}

// 用户选择匹配规则并获取Pattern
async function getPattern(rootPath: string) {
	// 从VS插件设置中获取要排除的文件及文件夹
	const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('copyrightCode');
    const skipDirectories: string[] = config.get('skipDirectories', []);

    // 过滤并转换为 glob 模式
    const stringSkipDirectories = skipDirectories
        .filter((item: string) => typeof item === 'string')
        .map(item => `**/${item}/**`)
        .join(',');

	// 让用户选择需要提取的文件后缀名
	const selectedExtensions = await selectFileExtensions(rootPath, skipDirectories);
	if (!selectedExtensions || selectedExtensions.length === 0) {
		vscode.window.showErrorMessage('没有选择任何后缀');
		return false;
	}

	// 将用户选择的后缀转换为 glob 模式的字符串
	const includeExtensions = selectedExtensions.map(ext => `**/*.${ext}`).join(',');
	// 让用户选择需要排除的目录
	const excludeDirs = await selectExcludeDirs(rootPath, skipDirectories, selectedExtensions);
	// 内置的需要排除的文件，即使你不选择，它也会被排除
	const builtInExcludeFiles = ['extractedCode.txt', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
	// 让用户选择需要排除的根目录文件
	const excludeFiles = await selectedRootPathFiles(rootPath, selectedExtensions, builtInExcludeFiles);
	// 将需要排除的文件转换为 glob 模式的字符串
	const stringExcludeFiles = builtInExcludeFiles.concat(excludeFiles || []).map(item => `**/${item}`).join(',');
	// 创建 glob 模式
	const includePattern = new vscode.RelativePattern(rootPath, `{${includeExtensions}}`);
	const excludePattern = new vscode.RelativePattern(rootPath,
		`{${stringExcludeFiles},${excludeDirs.join(',')},${stringSkipDirectories},**/.*/**}`
	);
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
