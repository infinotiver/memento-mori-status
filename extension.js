const vscode = require('vscode');

function activate(context) {
	let statusData = {};
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(statusBarItem);

	const config = vscode.workspace.getConfiguration('mementoMori');
	let birthDateStr = config.get('birthDate') || '1990-01-01';
	let lifeExpectancy = config.get('lifeExpectancy') || 80;
	let displayFormat = config.get('displayFormat') || "Day %dayProgress% · Year %yearProgress% · Life %lifeProgress%";

	// Validate configuration values
	function validateConfig() {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) {
			vscode.window.showErrorMessage(`Invalid birth date format: ${birthDateStr}. Resetting to default.`);
			birthDateStr = '1990-01-01';
		}
		if (isNaN(lifeExpectancy) || lifeExpectancy <= 0) {
			vscode.window.showErrorMessage(`Invalid life expectancy: ${lifeExpectancy}. Resetting to default.`);
			lifeExpectancy = 80;
		}
		if (typeof displayFormat !== 'string') {
			vscode.window.showErrorMessage(`Invalid display format. Resetting to default.`);
			displayFormat = "Day %dayProgress% · Year %yearProgress% · Life %lifeProgress%";
		}
	}
	validateConfig();

	function percent(start, end, now) {
		return Math.round(((now - start) / (end - start) * 100)).toString();
	}

	function formatWithTokens(template, tokens) {
		let result = template;
		for (const [token, value] of Object.entries(tokens)) {
			result = result.split(token).join(value);
		}
		return result;
	}

	function diffYmd(from, to) {
		let years = to.getFullYear() - from.getFullYear();
		let months = to.getMonth() - from.getMonth();
		let days = to.getDate() - from.getDate();

		if (days < 0) {
			months -= 1;
			const previousMonth = new Date(to.getFullYear(), to.getMonth(), 0);
			days += previousMonth.getDate();
		}

		if (months < 0) {
			years -= 1;
			months += 12;
		}

		return { years, months, days };
	}

	function updateStatus() {
		const now = new Date();
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
		const dayProgress = percent(startOfDay, endOfDay, now);

		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() === 11 ? 0 : now.getMonth() + 1, 1);
		if (now.getMonth() === 11) endOfMonth.setFullYear(now.getFullYear() + 1);
		const monthProgress = percent(startOfMonth, endOfMonth, now);

		const startOfYear = new Date(now.getFullYear(), 0, 1);
		const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
		const yearProgress = percent(startOfYear, endOfYear, now);

		const birthDate = new Date(birthDateStr);
		if (isNaN(birthDate.getTime())) {
			statusBarItem.text = 'Memento Mori: invalid birth date';
			statusBarItem.show();
			return;
		}
		const expectedDeath = new Date(birthDate.getFullYear() + lifeExpectancy, birthDate.getMonth(), birthDate.getDate());
		const lifeProgress = percent(birthDate, expectedDeath, now);
		const ageParts = diffYmd(birthDate, now);
		const daysLeft = Math.max(0, Math.floor((expectedDeath.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
		const daysLived = Math.max(0, Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24)));
		const nextBirthday = new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate());
		if (nextBirthday < now) nextBirthday.setFullYear(now.getFullYear() + 1);
		const daysToNextBirthday = Math.max(0, Math.floor((nextBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

		const tokens = {
			// Descriptive camelCase tokens
			"%dayProgress%": `${dayProgress}%`,
			"%dayRemaining%": `${Math.max(0, 100 - parseInt(dayProgress, 10))}%`,
			"%monthProgress%": `${monthProgress}%`,
			"%monthRemaining%": `${Math.max(0, 100 - parseInt(monthProgress, 10))}%`,
			"%yearProgress%": `${yearProgress}%`,
			"%yearRemaining%": `${Math.max(0, 100 - parseInt(yearProgress, 10))}%`,
			"%lifeProgress%": `${lifeProgress}%`,
			"%lifeRemaining%": `${Math.max(0, 100 - parseInt(lifeProgress, 10))}%`,
			"%ageYears%": `${ageParts.years}y`,
			"%ageYearsMonthsDays%": `${ageParts.years}y ${ageParts.months}m ${ageParts.days}d`,
			"%daysLived%": `${daysLived}`,
			"%daysLeftLife%": `${daysLeft}`,
			"%daysUntilBirthday%": `${daysToNextBirthday}`,
			// Legacy placeholders for backward compatibility
			"{dayProgress}": `${dayProgress}`,
			"{monthProgress}": `${monthProgress}`,
			"{yearProgress}": `${yearProgress}`,
			"{lifeProgress}": `${lifeProgress}`
		};

		statusBarItem.text = formatWithTokens(displayFormat, tokens);
		console.log("Updating statusbar text");

		const createProgressBar = (progress) => {
			const value = Math.min(10, Math.max(0, Math.round(parseInt(progress, 10) / 10)));
			return `${'█'.repeat(value)}${'░'.repeat(10 - value)}`;
		};

		const dayProgressBar = createProgressBar(dayProgress);
		const monthProgressBar = createProgressBar(monthProgress);
		const yearProgressBar = createProgressBar(yearProgress);
		const lifeProgressBar = createProgressBar(lifeProgress);

		statusBarItem.tooltip =
			`${dayProgressBar} Day: ${dayProgress}%\n` +
			`${monthProgressBar} Month: ${monthProgress}%\n` +
			`${yearProgressBar} Year: ${yearProgress}%\n` +
			`${lifeProgressBar} Life: ${lifeProgress}%\n` +
			`DOB: ${birthDateStr}`;
		statusBarItem.show();
		// Save for commands
		statusData = { dayProgress, monthProgress, yearProgress, lifeProgress, birthDateStr, expectedDeath };
	}

	updateStatus();
	const interval = setInterval(updateStatus, 5 *60 * 1000);
	context.subscriptions.push({ dispose: () => clearInterval(interval) });

	// Command: Show Full Stats
	const showStats = vscode.commands.registerCommand('mementoMori.showStats', () => {
		const { dayProgress, monthProgress, yearProgress, lifeProgress, birthDateStr, expectedDeath } = statusData || {};
		const now = new Date();
		const birthDate = new Date(birthDateStr);
		if (isNaN(birthDate.getTime())) {
			vscode.window.showErrorMessage(`Invalid birth date: ${birthDateStr}`);
			return;
		}
		const daysLived = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
		const daysRemaining = Math.floor((expectedDeath.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

		vscode.window.showInformationMessage(
			`Date of Birth: ${birthDateStr}.\n` +
			`Day Progress: ${dayProgress}%.\n` +
			`Month Progress: ${monthProgress}%.\n` +
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

	// Command: Reset Configuration
	const resetConfig = vscode.commands.registerCommand('mementoMori.resetConfig', async () => {
		await vscode.workspace.getConfiguration('mementoMori').update('birthDate', '1990-01-01', vscode.ConfigurationTarget.Global);
		await vscode.workspace.getConfiguration('mementoMori').update('lifeExpectancy', 80, vscode.ConfigurationTarget.Global);
		await vscode.workspace.getConfiguration('mementoMori').update('displayFormat', "Day %dayProgress% · Year %yearProgress% · Life %lifeProgress%", vscode.ConfigurationTarget.Global);
		birthDateStr = '1990-01-01';
		lifeExpectancy = 80;
		displayFormat = "Day %dayProgress% · Year %yearProgress% · Life %lifeProgress%";
		updateStatus();
		vscode.window.showInformationMessage('Configuration reset to defaults.');
	});
	context.subscriptions.push(resetConfig);
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
};
