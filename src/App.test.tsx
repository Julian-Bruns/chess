import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App controls', () => {
  it('keeps update and timing controls in the options menu', () => {
    const { container } = render(<App />);

    expect(screen.getByRole('button', { name: /options/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /update chessfish/i })).toBeNull();
    expect(container.querySelector('.eval-bar')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /options/i }));

    expect(screen.getByRole('button', { name: /install update/i })).toBeTruthy();
    expect(screen.getByLabelText(/time per stockfish move/i)).toBeTruthy();

    const evalToggle = screen.getByLabelText(/show evaluation bar/i) as HTMLInputElement;
    expect(evalToggle.checked).toBe(true);

    fireEvent.click(evalToggle);
    expect(container.querySelector('.eval-bar')).toBeNull();
  });

  it('records SAN moves and can jump through move history', () => {
    render(<App />);

    const backButton = screen.getByRole('button', { name: /go back one move/i }) as HTMLButtonElement;
    expect(backButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /white pawn on e2/i }));
    fireEvent.click(screen.getByRole('button', { name: 'e4' }));

    const moveHistory = screen.getByLabelText(/move history/i);
    const e4Move = within(moveHistory).getByRole('button', { name: 'e4' });
    expect(e4Move).toBeTruthy();
    expect(backButton.disabled).toBe(false);

    fireEvent.click(backButton);
    expect(screen.getByRole('button', { name: /white pawn on e2/i })).toBeTruthy();

    fireEvent.click(e4Move);
    expect(screen.getByRole('button', { name: /white pawn on e4/i })).toBeTruthy();
  });
});
