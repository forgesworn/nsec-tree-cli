export class MemoryIo {
  constructor(stdinText = '', isStdoutTty = false) {
    this.stdinText = stdinText
    this.isStdoutTty = isStdoutTty
    this.stdoutBuffer = ''
    this.stderrBuffer = ''
    this.secretAnswers = []
    this.promptedLabels = []
  }
  async stdout(text) { this.stdoutBuffer += text }
  async stderr(text) { this.stderrBuffer += text }
  async readStdin() { return this.stdinText }
  async promptSecret(label) {
    this.promptedLabels.push(label)
    if (this.secretAnswers.length === 0) {
      throw new Error(`MemoryIo.promptSecret called for "${label}" but no answer was queued`)
    }
    return this.secretAnswers.shift()
  }
}

export const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
