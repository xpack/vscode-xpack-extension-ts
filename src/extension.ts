// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

// This method is called when your extension is activated
export async function activate (context: vscode.ExtensionContext): Promise<void> {
  console.log('"ilg-vscode.xpack" activated')

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const commandGreeting = vscode.commands.registerCommand('xpack.greeting', async () => {
    // The code you place here will be executed every time your command is executed

    // Display a message box to the user
    await vscode.window.showInformationMessage('Greetings from the xPack C/C++ Managed Build!')
  })

  context.subscriptions.push(commandGreeting)
}

// this method is called when your extension is deactivated
export function deactivate (): void {
  console.log('"ilg-vscode.xpack" deactivated')
}
