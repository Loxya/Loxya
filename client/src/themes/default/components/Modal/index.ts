import './index.scss';
import Modal from '@/components/Modal/raw';
import createModalPlugin from '@/components/Modal/plugin';

export const plugin = createModalPlugin(Modal);

export default Modal;
