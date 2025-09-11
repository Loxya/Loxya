import Requester from '@/utils/requester';

const requester = new Requester();

export const init = (): void => {
    requester.init();
};

export * from '@/utils/requester';
export default requester;
