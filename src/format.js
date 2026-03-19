const CONTENT_WIDTH = 60
const LABEL_WIDTH = 14

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

export function createFormatter({ colour = false } = {}) {
  const c = colour
    ? {
        reset: ANSI.reset,
        bold: ANSI.bold,
        dim: ANSI.dim,
        red: ANSI.red,
        green: ANSI.green,
        yellow: ANSI.yellow,
        cyan: ANSI.cyan,
      }
    : { reset: '', bold: '', dim: '', red: '', green: '', yellow: '', cyan: '' }

  function labelValue(label, value) {
    const padded = label.length >= LABEL_WIDTH ? `${label}  ` : label.padEnd(LABEL_WIDTH)
    return `  ${c.dim}${padded}${c.reset}${c.bold}${value}${c.reset}`
  }

  function boxHeader(title) {
    const inner = CONTENT_WIDTH - 4
    const padded = title.padEnd(inner)
    return [
      `${c.cyan}╭${'─'.repeat(CONTENT_WIDTH - 2)}╮${c.reset}`,
      `${c.cyan}│${c.reset}  ${c.bold}${padded}${c.reset}${c.cyan}│${c.reset}`,
      `${c.cyan}╰${'─'.repeat(CONTENT_WIDTH - 2)}╯${c.reset}`,
    ].join('\n')
  }

  function warning(text) {
    return `  ${c.yellow}${text}${c.reset}`
  }

  function success(text) {
    return `  ${c.green}✓ ${text}${c.reset}`
  }

  function failure(text) {
    return `  ${c.red}✗ ${text}${c.reset}`
  }

  function nextSteps(commands) {
    const lines = [`  ${c.dim}Try next:${c.reset}`]
    for (const cmd of commands) {
      lines.push(`    ${c.cyan}${cmd}${c.reset}`)
    }
    return lines.join('\n')
  }

  function wrapWords(text, indent = LABEL_WIDTH + 2) {
    const words = text.split(/\s+/)
    const maxWidth = CONTENT_WIDTH - indent
    const lines = []
    let current = ''

    for (const word of words) {
      if (current && current.length + 1 + word.length > maxWidth) {
        lines.push(current)
        current = word
      } else {
        current = current ? `${current} ${word}` : word
      }
    }
    if (current) lines.push(current)

    return lines.join(`\n${' '.repeat(indent)}`)
  }

  function renderTree(segments) {
    const lines = [`  ${c.dim}root${c.reset}`]
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const isLast = i === segments.length - 1
      const depth = i + 1
      const indent = '  ' + '   '.repeat(depth)
      const branch = '└─'
      const label = `${seg.name}@${seg.actualIndex}`
      const suffix = isLast ? `  ${c.dim}(leaf)${c.reset}` : ''
      lines.push(`${indent}${c.dim}${branch}${c.reset} ${c.bold}${label}${c.reset}${' '.repeat(Math.max(1, 20 - label.length))}${c.cyan}${seg.npub}${c.reset}${suffix}`)
    }
    return lines.join('\n')
  }

  function section(lines) {
    return lines.filter(l => l !== null && l !== undefined).join('\n')
  }

  function blank() {
    return ''
  }

  return {
    labelValue,
    boxHeader,
    warning,
    success,
    failure,
    nextSteps,
    wrapWords,
    renderTree,
    section,
    blank,
    c,
    CONTENT_WIDTH,
    LABEL_WIDTH,
  }
}
