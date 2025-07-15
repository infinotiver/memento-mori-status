const vscode = require('vscode');

function activate(context) {
	let statusData = {}
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(statusBarItem);

	const config = vscode.workspace.getConfiguration('mementoMori');
	let birthDateStr = config.get('birthDate') || '1990-01-01';
	let lifeExpectancy = config.get('lifeExpectancy') || 80;

	function percent(start, end, now) {
		return Math.round(((now - start) / (end - start) * 100)).toString();
	}

	function updateStatus() {
		const now = new Date();

		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
		const dayProgress = percent(startOfDay, endOfDay, now);

		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		const monthProgress = percent(startOfMonth, endOfMonth, now);

		const startOfYear = new Date(now.getFullYear(), 0, 1);
		const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
		const yearProgress = percent(startOfYear, endOfYear, now);

		const birthDate = new Date(birthDateStr);
		const expectedDeath = new Date(birthDate.getFullYear() + lifeExpectancy, birthDate.getMonth(), birthDate.getDate());
		const lifeProgress =percent(birthDate, expectedDeath, now);

		statusBarItem.text = `Day: ${dayProgress}% Month: ${monthProgress} Year: ${yearProgress}% Life: ${lifeProgress}%`;

		const dayProgressBar = `${'█'.repeat(parseInt(dayProgress, 10) / 10)}${'░'.repeat(10 - parseInt(dayProgress, 10) / 10)}`;
		const yearProgressBar = `${'█'.repeat(parseInt(yearProgress, 10) / 10)}${'░'.repeat(10 - parseInt(yearProgress, 10) / 10)}`;
		const lifeProgressBar = `${'█'.repeat(parseInt(lifeProgress, 10) / 10)}${'░'.repeat(10 - parseInt(lifeProgress, 10) / 10)}`;


		statusBarItem.tooltip = 
			`${dayProgressBar} Day: ${dayProgress}%\n` +
			`${yearProgressBar} Year: ${yearProgress}%\n` +
			`${lifeProgressBar} Life: ${lifeProgress}%\n` +
			`DOB: ${birthDateStr}`;
		statusBarItem.show();

		// Save for commands
		statusData = { dayProgress, yearProgress, lifeProgress, birthDateStr, expectedDeath };
	}

	updateStatus();
	const interval = setInterval(updateStatus, 60 * 1000);
	context.subscriptions.push({ dispose: () => clearInterval(interval) });

	// Command: Show Full Stats
	const showStats = vscode.commands.registerCommand('mementoMori.showStats', () => {
		const { dayProgress, yearProgress, lifeProgress, birthDateStr, expectedDeath } = statusData || {};
		const now = new Date();
		const daysLived = Math.floor((now - new Date(birthDateStr)) / (1000 * 60 * 60 * 24));
		const daysRemaining = Math.floor((expectedDeath - now) / (1000 * 60 * 60 * 24));
		const weeksLived = Math.floor(daysLived / 7);
		const weeksRemaining = Math.floor(daysRemaining / 7);

		vscode.window.showInformationMessage(
			`Date of Birth: ${birthDateStr}.\n` +
			`Day Progress: ${dayProgress}%.\n` +
			`Year Progress: ${yearProgress}%.\n` +
			`Life Progress: ${lifeProgress}%.\n` +
			`Days Lived: ${daysLived} days.\n` +
			`Days Remaining: ${daysRemaining} days.\n`
		);
	});
	context.subscriptions.push(showStats);

	// Command: Set Birth Date
	const setBirthDate = vscode.commands.registerCommand('mementoMori.setBirthDate', async () => {
		const input = await vscode.window.showInputBox({
			prompt: "Enter your birth date (YYYY-MM-DD)",
			validateInput: (val) => /^\d{4}-\d{2}-\d{2}$/.test(val) ? null : "Invalid format. Use YYYY-MM-DD."
		});
		if (input) {
			await vscode.workspace.getConfiguration('mementoMori').update('birthDate', input, vscode.ConfigurationTarget.Global);
			birthDateStr = input;
			updateStatus();
			vscode.window.showInformationMessage(`🎉 Birth date set to ${input}`);
		}
	});
	context.subscriptions.push(setBirthDate);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
};
