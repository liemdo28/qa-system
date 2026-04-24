import { EventEmitter } from 'events';
import { WSMessage } from '../qa-engine/types';

class WsEmitter extends EventEmitter {}

export const wsEmitter = new WsEmitter();

export function broadcast(message: WSMessage): void {
  wsEmitter.emit('broadcast', message);
}
