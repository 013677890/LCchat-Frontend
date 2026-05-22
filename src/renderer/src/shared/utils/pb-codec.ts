/**
 * Pure TypeScript Protobuf Varint/Length-delimited binary codec.
 * No external dependencies. Safe for Electron production building on all platforms.
 */

class PbReader {
  private buf: Uint8Array;
  private pos = 0;

  constructor(buf: Uint8Array) {
    this.buf = buf;
  }

  hasMore(): boolean {
    return this.pos < this.buf.length;
  }

  readVarint(): number {
    let val = 0;
    let shift = 0;
    while (true) {
      if (this.pos >= this.buf.length) throw new Error("Varint out of bounds");
      const b = this.buf[this.pos++];
      if (b === undefined) throw new Error("Varint out of bounds");
      val += (b & 0x7f) * Math.pow(2, shift);
      if (!(b & 0x80)) break;
      shift += 7;
    }
    return val;
  }

  readVarint64(): number {
    // JavaScript safe integers are up to 2^53 - 1 (approx 9e15).
    // Millisecond timestamps (~1.7e12) and sequences fit comfortably.
    return this.readVarint();
  }

  readString(): string {
    const len = this.readVarint();
    if (this.pos + len > this.buf.length) throw new Error("String length out of bounds");
    const bytes = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return new TextDecoder().decode(bytes);
  }

  readBytes(): Uint8Array {
    const len = this.readVarint();
    if (this.pos + len > this.buf.length) throw new Error("Bytes length out of bounds");
    const bytes = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return bytes;
  }

  skip(wireType: number) {
    if (wireType === 0) {
      this.readVarint();
    } else if (wireType === 1) {
      this.pos += 8;
    } else if (wireType === 2) {
      const len = this.readVarint();
      this.pos += len;
    } else if (wireType === 5) {
      this.pos += 4;
    } else {
      throw new Error(`Unsupported wire type: ${wireType}`);
    }
  }
}

class PbWriter {
  private buf: number[] = [];

  writeVarint(val: number) {
    let v = Math.floor(val);
    if (v < 0) {
      // Write negative integer as negative 64-bit int (10 bytes)
      for (let i = 0; i < 9; i++) {
        this.buf.push((v & 0x7f) | 0x80);
        v >>= 7;
      }
      this.buf.push(1);
      return;
    }
    while (v >= 0x80) {
      this.buf.push((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    this.buf.push(v & 0x7f);
  }

  writeString(fieldNumber: number, str: string) {
    if (str === undefined || str === null || str === "") return;
    const bytes = new TextEncoder().encode(str);
    this.writeTag(fieldNumber, 2);
    this.writeVarint(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        this.buf.push(byte);
      }
    }
  }

  writeBytes(fieldNumber: number, bytes: Uint8Array) {
    if (!bytes || bytes.length === 0) return;
    this.writeTag(fieldNumber, 2);
    this.writeVarint(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        this.buf.push(byte);
      }
    }
  }

  writeTag(fieldNumber: number, wireType: number) {
    this.writeVarint((fieldNumber << 3) | wireType);
  }

  writeInt32(fieldNumber: number, val: number) {
    if (!val) return;
    this.writeTag(fieldNumber, 0);
    this.writeVarint(val);
  }

  writeInt64(fieldNumber: number, val: number) {
    if (!val) return;
    this.writeTag(fieldNumber, 0);
    this.writeVarint(val);
  }

  writeBool(fieldNumber: number, val: boolean) {
    if (!val) return;
    this.writeTag(fieldNumber, 0);
    this.writeVarint(val ? 1 : 0);
  }

  finish(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

export interface MessageEnvelope {
  type: string;
  data: Uint8Array;
  seq: number;
  serverTs: number;
  traceId: string;
  ackRequired: boolean;
}

export interface MessageAck {
  convId: string;
  seq: number;
  msgId?: string;
}

export interface MessageAckAck {
  convId: string;
  seq: number;
}

export interface MsgItem {
  msgId: string;
  clientMsgId: string;
  convId: string;
  seq: number;
  fromUuid: string;
  msgType: number;
  content: string;
  status: number;
  sendTime: number;
  replyToMsgId: string;
  atUsers: string[];
}

export interface RecallNotice {
  convId: string;
  msgId: string;
  operator: string;
  recallTime: number;
}

export interface MarkReadNotice {
  convId: string;
  readSeq: number;
}

export interface ErrorFrame {
  code: number;
  message: string;
}

export function decodeMessageEnvelope(buf: Uint8Array): MessageEnvelope {
  const reader = new PbReader(buf);
  const envelope: MessageEnvelope = {
    type: "",
    data: new Uint8Array(),
    seq: 0,
    serverTs: 0,
    traceId: "",
    ackRequired: false
  };

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 1 && wireType === 2) {
      envelope.type = reader.readString();
    } else if (fieldNumber === 2 && wireType === 2) {
      envelope.data = reader.readBytes();
    } else if (fieldNumber === 3 && wireType === 0) {
      envelope.seq = reader.readVarint64();
    } else if (fieldNumber === 4 && wireType === 0) {
      envelope.serverTs = reader.readVarint64();
    } else if (fieldNumber === 5 && wireType === 2) {
      envelope.traceId = reader.readString();
    } else if (fieldNumber === 6 && wireType === 0) {
      envelope.ackRequired = reader.readVarint() !== 0;
    } else {
      reader.skip(wireType);
    }
  }
  return envelope;
}

export function encodeMessageEnvelope(envelope: Partial<MessageEnvelope>): Uint8Array {
  const writer = new PbWriter();
  if (envelope.type) writer.writeString(1, envelope.type);
  if (envelope.data && envelope.data.length > 0) writer.writeBytes(2, envelope.data);
  if (envelope.seq) writer.writeInt64(3, envelope.seq);
  if (envelope.serverTs) writer.writeInt64(4, envelope.serverTs);
  if (envelope.traceId) writer.writeString(5, envelope.traceId);
  if (envelope.ackRequired) writer.writeBool(6, envelope.ackRequired);
  return writer.finish();
}

export function encodeMessageAck(ack: MessageAck): Uint8Array {
  const writer = new PbWriter();
  if (ack.convId) writer.writeString(1, ack.convId);
  if (ack.seq) writer.writeInt64(2, ack.seq);
  if (ack.msgId) writer.writeString(3, ack.msgId);
  return writer.finish();
}

export function decodeMsgItem(buf: Uint8Array): MsgItem {
  const reader = new PbReader(buf);
  const msg: MsgItem = {
    msgId: "",
    clientMsgId: "",
    convId: "",
    seq: 0,
    fromUuid: "",
    msgType: 0,
    content: "",
    status: 0,
    sendTime: 0,
    replyToMsgId: "",
    atUsers: []
  };

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 1 && wireType === 2) {
      msg.msgId = reader.readString();
    } else if (fieldNumber === 2 && wireType === 2) {
      msg.clientMsgId = reader.readString();
    } else if (fieldNumber === 3 && wireType === 2) {
      msg.convId = reader.readString();
    } else if (fieldNumber === 4 && wireType === 0) {
      msg.seq = reader.readVarint64();
    } else if (fieldNumber === 5 && wireType === 2) {
      msg.fromUuid = reader.readString();
    } else if (fieldNumber === 6 && wireType === 0) {
      msg.msgType = reader.readVarint();
    } else if (fieldNumber === 7 && wireType === 2) {
      msg.content = reader.readString();
    } else if (fieldNumber === 8 && wireType === 0) {
      msg.status = reader.readVarint();
    } else if (fieldNumber === 9 && wireType === 0) {
      msg.sendTime = reader.readVarint64();
    } else if (fieldNumber === 10 && wireType === 2) {
      msg.replyToMsgId = reader.readString();
    } else if (fieldNumber === 11 && wireType === 2) {
      msg.atUsers.push(reader.readString());
    } else {
      reader.skip(wireType);
    }
  }
  return msg;
}

export function decodeRecallNotice(buf: Uint8Array): RecallNotice {
  const reader = new PbReader(buf);
  const notice: RecallNotice = {
    convId: "",
    msgId: "",
    operator: "",
    recallTime: 0
  };

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 1 && wireType === 2) {
      notice.convId = reader.readString();
    } else if (fieldNumber === 2 && wireType === 2) {
      notice.msgId = reader.readString();
    } else if (fieldNumber === 3 && wireType === 2) {
      notice.operator = reader.readString();
    } else if (fieldNumber === 4 && wireType === 0) {
      notice.recallTime = reader.readVarint64();
    } else {
      reader.skip(wireType);
    }
  }
  return notice;
}

export function decodeMarkReadNotice(buf: Uint8Array): MarkReadNotice {
  const reader = new PbReader(buf);
  const notice: MarkReadNotice = {
    convId: "",
    readSeq: 0
  };

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 1 && wireType === 2) {
      notice.convId = reader.readString();
    } else if (fieldNumber === 2 && wireType === 0) {
      notice.readSeq = reader.readVarint64();
    } else {
      reader.skip(wireType);
    }
  }
  return notice;
}

export function decodeMessageAckAck(buf: Uint8Array): MessageAckAck {
  const reader = new PbReader(buf);
  const notice: MessageAckAck = {
    convId: "",
    seq: 0
  };

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 1 && wireType === 2) {
      notice.convId = reader.readString();
    } else if (fieldNumber === 2 && wireType === 0) {
      notice.seq = reader.readVarint64();
    } else {
      reader.skip(wireType);
    }
  }
  return notice;
}

export function decodeErrorFrame(buf: Uint8Array): ErrorFrame {
  const reader = new PbReader(buf);
  const frame: ErrorFrame = {
    code: 0,
    message: ""
  };

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 1 && wireType === 0) {
      frame.code = reader.readVarint();
    } else if (fieldNumber === 2 && wireType === 2) {
      frame.message = reader.readString();
    } else {
      reader.skip(wireType);
    }
  }
  return frame;
}
