export class MemoryIo {
  constructor(stdinText = '', isStdoutTty = false) {
    this.stdinText = stdinText
    this.isStdoutTty = isStdoutTty
    this.stdoutBuffer = ''
    this.stderrBuffer = ''
  }
  async stdout(text) { this.stdoutBuffer += text }
  async stderr(text) { this.stderrBuffer += text }
  async readStdin() { return this.stdinText }
}

export const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
