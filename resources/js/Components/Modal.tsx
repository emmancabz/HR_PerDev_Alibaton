import {
    Dialog,
    DialogPanel,
    Transition,
    TransitionChild,
} from '@headlessui/react';
import { PropsWithChildren } from 'react';

export const MODAL_STRUCTURE_CLASSES = {
    root: 'pointer-events-none',
    backdrop: 'z-0 pointer-events-auto',
    panel: 'relative z-10 isolate pointer-events-auto',
} as const;

export default function Modal({
    children,
    show = false,
    maxWidth = '2xl',
    closeable = true,
    onClose = () => {},
    overlayClassName,
    panelClassName,
    rootClassName,
    dialogId,
    ariaLabel,
}: PropsWithChildren<{
    show: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    closeable?: boolean;
    onClose: CallableFunction;
    overlayClassName?: string;
    panelClassName?: string;
    rootClassName?: string;
    dialogId?: string;
    ariaLabel?: string;
}>) {
    const close = () => {
        if (closeable) {
            onClose();
        }
    };

    const maxWidthClass = {
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-md',
        lg: 'sm:max-w-lg',
        xl: 'sm:max-w-xl',
        '2xl': 'sm:max-w-2xl',
    }[maxWidth];

    return (
        <Transition show={show} leave="duration-200">
            <Dialog
                as="div"
                id={dialogId}
                aria-label={ariaLabel}
                data-overlay-root="modal"
                className={`fixed inset-0 flex items-center overflow-y-auto px-4 py-6 sm:px-0 ${MODAL_STRUCTURE_CLASSES.root} ${rootClassName ?? 'z-50'}`}
                onClose={close}
            >
                <TransitionChild
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div
                        data-overlay-part="backdrop"
                        className={`absolute inset-0 ${MODAL_STRUCTURE_CLASSES.backdrop} ${overlayClassName ?? 'bg-gray-500/75 dark:bg-gray-900/75'}`}
                        onClick={close}
                    />
                </TransitionChild>

                <TransitionChild
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                    enterTo="opacity-100 translate-y-0 sm:scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                    leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                    <DialogPanel
                        data-overlay-part="panel"
                        className={`mb-6 transform overflow-hidden rounded-lg bg-white shadow-xl transition-all sm:mx-auto sm:w-full dark:bg-gray-800 ${MODAL_STRUCTURE_CLASSES.panel} ${panelClassName ?? ''} ${maxWidthClass}`}
                    >
                        {children}
                    </DialogPanel>
                </TransitionChild>
            </Dialog>
        </Transition>
    );
}
