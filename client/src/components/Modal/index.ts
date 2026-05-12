import './index.scss';
import Modal from './raw';
import createModalPlugin from './plugin';

export const plugin = createModalPlugin(Modal);

export default Modal;
