// Sheet: closes on Escape, scrim tap and a drag of the grabber or heading downwards; the body is not draggable.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sheet } from '../src/components/Sheet';
import { I18nProvider } from '../src/i18n';

afterEach(cleanup);

const open = () => {
  const onClose = vi.fn();
  const { container } = render(
    <I18nProvider initial="en">
      <Sheet title="Pick" onClose={onClose}>
        <p>Body</p>
      </Sheet>
    </I18nProvider>,
  );
  return { onClose, container };
};
const drag = (el: Element, from: number, to: number) => {
  fireEvent.pointerDown(el, { clientY: from, pointerId: 1 });
  fireEvent.pointerMove(window, { clientY: (from + to) / 2, pointerId: 1 });
  fireEvent.pointerMove(window, { clientY: to, pointerId: 1 });
  fireEvent.pointerUp(window, { clientY: to, pointerId: 1 });
};

describe('Sheet drag to close (JCB-93)', () => {
  it('closes when the heading is dragged far enough down, and follows the finger meanwhile', () => {
    const { onClose } = open();
    const head = screen.getByRole('heading', { name: 'Pick' }).parentElement!;
    const sheet = screen.getByRole('dialog');
    fireEvent.pointerDown(head, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 150, pointerId: 1 });
    expect(sheet.style.transform).toBe('translateY(50px)');
    fireEvent.pointerUp(window, { clientY: 260, pointerId: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('springs back on a short drag, ignores upward drags and a plain tap, and the body does not drag', () => {
    const { onClose, container } = open();
    const head = screen.getByRole('heading', { name: 'Pick' }).parentElement!;
    const sheet = screen.getByRole('dialog');
    fireEvent.pointerDown(head, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 130, pointerId: 1 });
    fireEvent.pointerUp(window, { clientY: 130, pointerId: 1 });
    expect(sheet.style.transform).toBe('');
    drag(head, 100, 20);
    fireEvent.pointerDown(head, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(window, { clientY: 100, pointerId: 1 });
    drag(container.querySelector('.sheet__body')!, 100, 400);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Close and the scrim still work', () => {
    const { onClose, container } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(container.querySelector('.sheet-scrim')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
