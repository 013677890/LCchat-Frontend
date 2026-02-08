/* eslint-disable */

/**
 * Lightweight QR generator adapted from qrcode-generator (MIT).
 * Kept local to avoid remote image API dependency.
 */
function createQrcode(typeNumber: number, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H') {
  const PAD0 = 0xec
  const PAD1 = 0x11
  const QRMode = { MODE_8BIT_BYTE: 1 << 2 }
  const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 }
  const QRMaskPattern = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  }

  const qrPolynomial = (num: number[], shift: number) => {
    let offset = 0
    while (offset < num.length && num[offset] === 0) {
      offset += 1
    }
    const value = new Array(num.length - offset + shift)
    for (let i = 0; i < num.length - offset; i += 1) {
      value[i] = num[i + offset]
    }
    return {
      getAt: (idx: number) => value[idx],
      getLength: () => value.length,
      multiply: (e: ReturnType<typeof qrPolynomial>) => {
        const out = new Array(value.length + e.getLength() - 1).fill(0)
        for (let i = 0; i < value.length; i += 1) {
          for (let j = 0; j < e.getLength(); j += 1) {
            out[i + j] ^= QRMath.gexp(QRMath.glog(value[i]) + QRMath.glog(e.getAt(j)))
          }
        }
        return qrPolynomial(out, 0)
      },
      mod: (e: ReturnType<typeof qrPolynomial>): ReturnType<typeof qrPolynomial> => {
        if (value.length - e.getLength() < 0) {
          return qrPolynomial(value, 0)
        }
        const ratio = QRMath.glog(value[0]) - QRMath.glog(e.getAt(0))
        const out = value.slice()
        for (let i = 0; i < e.getLength(); i += 1) {
          out[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio)
        }
        return qrPolynomial(out, 0).mod(e)
      }
    }
  }

  const QRMath = {
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256),
    glog: (n: number) => {
      if (n < 1) {
        throw new Error(`glog(${n})`)
      }
      return QRMath.LOG_TABLE[n]
    },
    gexp: (n: number) => {
      while (n < 0) {
        n += 255
      }
      while (n >= 256) {
        n -= 255
      }
      return QRMath.EXP_TABLE[n]
    }
  }
  for (let i = 0; i < 8; i += 1) {
    QRMath.EXP_TABLE[i] = 1 << i
  }
  for (let i = 8; i < 256; i += 1) {
    QRMath.EXP_TABLE[i] =
      QRMath.EXP_TABLE[i - 4] ^
      QRMath.EXP_TABLE[i - 5] ^
      QRMath.EXP_TABLE[i - 6] ^
      QRMath.EXP_TABLE[i - 8]
  }
  for (let i = 0; i < 255; i += 1) {
    QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i
  }

  const QRUtil = {
    PATTERN_POSITION_TABLE: [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ],
    G15: 1335,
    G18: 7973,
    G15_MASK: 21522,
    getBCHTypeInfo(data: number) {
      let d = data << 10
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
        d ^= QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15))
      }
      return ((data << 10) | d) ^ QRUtil.G15_MASK
    },
    getBCHTypeNumber(data: number) {
      let d = data << 12
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
        d ^= QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18))
      }
      return (data << 12) | d
    },
    getBCHDigit(data: number) {
      let digit = 0
      while (data !== 0) {
        digit += 1
        data >>>= 1
      }
      return digit
    },
    getPatternPosition(type: number) {
      return QRUtil.PATTERN_POSITION_TABLE[type - 1]
    },
    getMask(maskPattern: number, i: number, j: number) {
      switch (maskPattern) {
        case QRMaskPattern.PATTERN000:
          return (i + j) % 2 === 0
        case QRMaskPattern.PATTERN001:
          return i % 2 === 0
        case QRMaskPattern.PATTERN010:
          return j % 3 === 0
        case QRMaskPattern.PATTERN011:
          return (i + j) % 3 === 0
        case QRMaskPattern.PATTERN100:
          return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0
        case QRMaskPattern.PATTERN101:
          return ((i * j) % 2) + ((i * j) % 3) === 0
        case QRMaskPattern.PATTERN110:
          return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0
        case QRMaskPattern.PATTERN111:
          return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0
        default:
          throw new Error(`bad maskPattern:${maskPattern}`)
      }
    },
    getErrorCorrectPolynomial(errorCorrectLength: number) {
      let a = qrPolynomial([1], 0)
      for (let i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0))
      }
      return a
    },
    getLengthInBits(mode: number, type: number) {
      if (1 <= type && type < 10) {
        if (mode === QRMode.MODE_8BIT_BYTE) {
          return 8
        }
      } else if (type < 27) {
        if (mode === QRMode.MODE_8BIT_BYTE) {
          return 16
        }
      } else if (type < 41) {
        if (mode === QRMode.MODE_8BIT_BYTE) {
          return 16
        }
      }
      throw new Error(`type:${type}/mode:${mode}`)
    },
    getLostPoint(qrCode: {
      getModuleCount: () => number
      isDark: (r: number, c: number) => boolean
    }) {
      const moduleCount = qrCode.getModuleCount()
      let lostPoint = 0
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount; col += 1) {
          let sameCount = 0
          const dark = qrCode.isDark(row, col)
          for (let r = -1; r <= 1; r += 1) {
            if (row + r < 0 || moduleCount <= row + r) {
              continue
            }
            for (let c = -1; c <= 1; c += 1) {
              if (col + c < 0 || moduleCount <= col + c) {
                continue
              }
              if (r === 0 && c === 0) {
                continue
              }
              if (dark === qrCode.isDark(row + r, col + c)) {
                sameCount += 1
              }
            }
          }
          if (sameCount > 5) {
            lostPoint += 3 + sameCount - 5
          }
        }
      }

      for (let row = 0; row < moduleCount - 1; row += 1) {
        for (let col = 0; col < moduleCount - 1; col += 1) {
          let count = 0
          if (qrCode.isDark(row, col)) count += 1
          if (qrCode.isDark(row + 1, col)) count += 1
          if (qrCode.isDark(row, col + 1)) count += 1
          if (qrCode.isDark(row + 1, col + 1)) count += 1
          if (count === 0 || count === 4) lostPoint += 3
        }
      }

      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount - 6; col += 1) {
          if (
            qrCode.isDark(row, col) &&
            !qrCode.isDark(row, col + 1) &&
            qrCode.isDark(row, col + 2) &&
            qrCode.isDark(row, col + 3) &&
            qrCode.isDark(row, col + 4) &&
            !qrCode.isDark(row, col + 5) &&
            qrCode.isDark(row, col + 6)
          ) {
            lostPoint += 40
          }
        }
      }
      for (let col = 0; col < moduleCount; col += 1) {
        for (let row = 0; row < moduleCount - 6; row += 1) {
          if (
            qrCode.isDark(row, col) &&
            !qrCode.isDark(row + 1, col) &&
            qrCode.isDark(row + 2, col) &&
            qrCode.isDark(row + 3, col) &&
            qrCode.isDark(row + 4, col) &&
            !qrCode.isDark(row + 5, col) &&
            qrCode.isDark(row + 6, col)
          ) {
            lostPoint += 40
          }
        }
      }

      let darkCount = 0
      for (let col = 0; col < moduleCount; col += 1) {
        for (let row = 0; row < moduleCount; row += 1) {
          if (qrCode.isDark(row, col)) {
            darkCount += 1
          }
        }
      }
      const ratio = Math.abs((100 * darkCount) / moduleCount / moduleCount - 50) / 5
      lostPoint += ratio * 10
      return lostPoint
    }
  }

  const QRRSBlock = {
    RS_BLOCK_TABLE: [
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16]
    ],
    getRSBlocks(type: number, ec: number) {
      const table = QRRSBlock.getRsBlockTable(type, ec)
      if (!table) {
        throw new Error(`bad rs block @ typeNumber:${type}/errorCorrectLevel:${ec}`)
      }
      const list = []
      for (let i = 0; i < table.length / 3; i += 1) {
        const count = table[i * 3 + 0]
        const totalCount = table[i * 3 + 1]
        const dataCount = table[i * 3 + 2]
        for (let j = 0; j < count; j += 1) {
          list.push({ totalCount, dataCount })
        }
      }
      return list
    },
    getRsBlockTable(type: number, ec: number) {
      switch (ec) {
        case QRErrorCorrectLevel.L:
          return QRRSBlock.RS_BLOCK_TABLE[(type - 1) * 4 + 0]
        case QRErrorCorrectLevel.M:
          return QRRSBlock.RS_BLOCK_TABLE[(type - 1) * 4 + 1]
        case QRErrorCorrectLevel.Q:
          return QRRSBlock.RS_BLOCK_TABLE[(type - 1) * 4 + 2]
        case QRErrorCorrectLevel.H:
          return QRRSBlock.RS_BLOCK_TABLE[(type - 1) * 4 + 3]
        default:
          return undefined
      }
    }
  }

  const qrBitBuffer = () => {
    const buffer: number[] = []
    let length = 0
    return {
      getBuffer: () => buffer,
      getAt: (index: number) => ((buffer[Math.floor(index / 8)] >>> (7 - (index % 8))) & 1) === 1,
      put: (num: number, len: number) => {
        for (let i = 0; i < len; i += 1) {
          const bit = ((num >>> (len - i - 1)) & 1) === 1
          if (length === buffer.length * 8) {
            buffer.push(0)
          }
          if (bit) {
            buffer[Math.floor(length / 8)] |= 0x80 >>> (length % 8)
          }
          length += 1
        }
      },
      getLengthInBits: () => length
    }
  }

  const qr8BitByte = (data: string) => {
    const out: number[] = []
    for (let i = 0; i < data.length; i += 1) {
      const code = data.charCodeAt(i)
      if (code > 0x7f) {
        out.push(0xc0 | ((code >>> 6) & 0x1f))
        out.push(0x80 | (code & 0x3f))
      } else {
        out.push(code)
      }
    }
    return {
      getMode: () => QRMode.MODE_8BIT_BYTE,
      getLength: () => out.length,
      write: (buffer: ReturnType<typeof qrBitBuffer>) => {
        for (let i = 0; i < out.length; i += 1) {
          buffer.put(out[i], 8)
        }
      }
    }
  }

  const dataList: Array<ReturnType<typeof qr8BitByte>> = []
  let modules: (boolean | null)[][] = []
  let moduleCount = 0

  function setupPositionProbePattern(row: number, col: number) {
    for (let r = -1; r <= 7; r += 1) {
      if (row + r <= -1 || moduleCount <= row + r) continue
      for (let c = -1; c <= 7; c += 1) {
        if (col + c <= -1 || moduleCount <= col + c) continue
        if (
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)
        ) {
          modules[row + r][col + c] = true
        } else {
          modules[row + r][col + c] = false
        }
      }
    }
  }

  function setupPositionAdjustPattern() {
    const pos = QRUtil.getPatternPosition(typeNumber)
    for (let i = 0; i < pos.length; i += 1) {
      for (let j = 0; j < pos.length; j += 1) {
        const row = pos[i]
        const col = pos[j]
        if (modules[row][col] !== null) continue
        for (let r = -2; r <= 2; r += 1) {
          for (let c = -2; c <= 2; c += 1) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
              modules[row + r][col + c] = true
            } else {
              modules[row + r][col + c] = false
            }
          }
        }
      }
    }
  }

  function setupTimingPattern() {
    for (let r = 8; r < moduleCount - 8; r += 1) {
      if (modules[r][6] !== null) continue
      modules[r][6] = r % 2 === 0
    }
    for (let c = 8; c < moduleCount - 8; c += 1) {
      if (modules[6][c] !== null) continue
      modules[6][c] = c % 2 === 0
    }
  }

  function setupTypeInfo(test: boolean, maskPattern: number) {
    const data = (QRErrorCorrectLevel[errorCorrectionLevel] << 3) | maskPattern
    const bits = QRUtil.getBCHTypeInfo(data)
    for (let i = 0; i < 15; i += 1) {
      const mod = !test && ((bits >>> i) & 1) === 1
      if (i < 6) modules[i][8] = mod
      else if (i < 8) modules[i + 1][8] = mod
      else modules[moduleCount - 15 + i][8] = mod

      if (i < 8) modules[8][moduleCount - i - 1] = mod
      else if (i < 9) modules[8][15 - i - 1 + 1] = mod
      else modules[8][15 - i - 1] = mod
    }
    modules[moduleCount - 8][8] = !test
  }

  function setupTypeNumber(test: boolean) {
    const bits = QRUtil.getBCHTypeNumber(typeNumber)
    for (let i = 0; i < 18; i += 1) {
      const mod = !test && ((bits >>> i) & 1) === 1
      modules[Math.floor(i / 3)][(i % 3) + moduleCount - 8 - 3] = mod
      modules[(i % 3) + moduleCount - 8 - 3][Math.floor(i / 3)] = mod
    }
  }

  function mapData(data: number[], maskPattern: number) {
    let inc = -1
    let row = moduleCount - 1
    let bitIndex = 7
    let byteIndex = 0
    for (let col = moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1
      while (true) {
        for (let c = 0; c < 2; c += 1) {
          if (modules[row][col - c] === null) {
            let dark = false
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1
            }
            if (QRUtil.getMask(maskPattern, row, col - c)) {
              dark = !dark
            }
            modules[row][col - c] = dark
            bitIndex -= 1
            if (bitIndex === -1) {
              byteIndex += 1
              bitIndex = 7
            }
          }
        }
        row += inc
        if (row < 0 || moduleCount <= row) {
          row -= inc
          inc = -inc
          break
        }
      }
    }
  }

  function createBytes(
    buffer: ReturnType<typeof qrBitBuffer>,
    rsBlocks: Array<{ totalCount: number; dataCount: number }>
  ) {
    let offset = 0
    let maxDcCount = 0
    let maxEcCount = 0
    const dcdata: number[][] = new Array(rsBlocks.length)
    const ecdata: number[][] = new Array(rsBlocks.length)

    for (let r = 0; r < rsBlocks.length; r += 1) {
      const dcCount = rsBlocks[r].dataCount
      const ecCount = rsBlocks[r].totalCount - dcCount
      maxDcCount = Math.max(maxDcCount, dcCount)
      maxEcCount = Math.max(maxEcCount, ecCount)
      dcdata[r] = new Array(dcCount)
      for (let i = 0; i < dcdata[r].length; i += 1) {
        dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset]
      }
      offset += dcCount
      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount)
      const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1)
      const modPoly = rawPoly.mod(rsPoly)
      ecdata[r] = new Array(rsPoly.getLength() - 1)
      for (let i = 0; i < ecdata[r].length; i += 1) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length
        ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0
      }
    }

    let totalCodeCount = 0
    for (let i = 0; i < rsBlocks.length; i += 1) totalCodeCount += rsBlocks[i].totalCount

    const data: number[] = new Array(totalCodeCount)
    let index = 0
    for (let i = 0; i < maxDcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < dcdata[r].length) data[index++] = dcdata[r][i]
      }
    }
    for (let i = 0; i < maxEcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < ecdata[r].length) data[index++] = ecdata[r][i]
      }
    }
    return data
  }

  function createData() {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, QRErrorCorrectLevel[errorCorrectionLevel])
    const buffer = qrBitBuffer()
    for (let i = 0; i < dataList.length; i += 1) {
      const data = dataList[i]
      buffer.put(data.getMode(), 4)
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber))
      data.write(buffer)
    }

    let totalDataCount = 0
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalDataCount += rsBlocks[i].dataCount
    }
    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw new Error(`code length overflow. (${buffer.getLengthInBits()}>${totalDataCount * 8})`)
    }
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4)
    while (buffer.getLengthInBits() % 8 !== 0) buffer.put(0, 1)
    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) break
      buffer.put(PAD0, 8)
      if (buffer.getLengthInBits() >= totalDataCount * 8) break
      buffer.put(PAD1, 8)
    }
    return createBytes(buffer, rsBlocks)
  }

  function makeImpl(test: boolean, maskPattern: number) {
    moduleCount = typeNumber * 4 + 17
    modules = new Array(moduleCount)
    for (let row = 0; row < moduleCount; row += 1) {
      modules[row] = new Array(moduleCount).fill(null)
    }
    setupPositionProbePattern(0, 0)
    setupPositionProbePattern(moduleCount - 7, 0)
    setupPositionProbePattern(0, moduleCount - 7)
    setupPositionAdjustPattern()
    setupTimingPattern()
    setupTypeInfo(test, maskPattern)
    if (typeNumber >= 7) setupTypeNumber(test)
    const data = createData()
    mapData(data, maskPattern)
  }

  function getBestMaskPattern() {
    let minLostPoint = 0
    let pattern = 0
    for (let i = 0; i < 8; i += 1) {
      makeImpl(true, i)
      const lostPoint = QRUtil.getLostPoint({
        getModuleCount: () => moduleCount,
        isDark: (r: number, c: number) => modules[r][c] === true
      })
      if (i === 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint
        pattern = i
      }
    }
    return pattern
  }

  return {
    addData(data: string) {
      dataList.push(qr8BitByte(data))
    },
    make() {
      makeImpl(false, getBestMaskPattern())
    },
    isDark(row: number, col: number) {
      if (row < 0 || moduleCount <= row || col < 0 || moduleCount <= col) {
        throw new Error(`${row},${col}`)
      }
      return modules[row][col] === true
    },
    getModuleCount() {
      return moduleCount
    }
  }
}

function renderSvgDataUrl(
  qr: ReturnType<typeof createQrcode>,
  options: { size?: number; margin?: number; dark?: string; light?: string } = {}
): string {
  const moduleCount = qr.getModuleCount()
  const margin = Math.max(0, options.margin ?? 4)
  const size = Math.max(120, options.size ?? 240)
  const dark = options.dark ?? '#111111'
  const light = options.light ?? '#ffffff'
  const cell = size / (moduleCount + margin * 2)
  const actualSize = cell * (moduleCount + margin * 2)

  let d = ''
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.isDark(row, col)) {
        continue
      }
      const x = (col + margin) * cell
      const y = (row + margin) * cell
      d += `M${x},${y}h${cell}v${cell}h-${cell}z`
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${actualSize}" height="${actualSize}" viewBox="0 0 ${actualSize} ${actualSize}" shape-rendering="crispEdges">` +
    `<rect width="${actualSize}" height="${actualSize}" fill="${light}"/>` +
    `<path d="${d}" fill="${dark}"/>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function buildQRCodeDataUrl(
  content: string,
  options: { size?: number; margin?: number; dark?: string; light?: string } = {}
): string {
  const normalized = content.trim()
  if (!normalized) {
    return ''
  }

  const levels: Array<'M' | 'Q' | 'H' | 'L'> = ['M', 'Q', 'H', 'L']
  for (let version = 1; version <= 10; version += 1) {
    for (let i = 0; i < levels.length; i += 1) {
      try {
        const qr = createQrcode(version, levels[i])
        qr.addData(normalized)
        qr.make()
        return renderSvgDataUrl(qr, options)
      } catch {
        // try next combination
      }
    }
  }
  throw new Error('二维码内容过长，当前版本暂不支持。')
}
