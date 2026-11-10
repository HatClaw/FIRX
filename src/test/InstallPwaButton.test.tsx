import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InstallPwaButton } from '@/components/pwa/InstallPwaButton';

function dispatchInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: 'android' }),
  });
  act(() => window.dispatchEvent(event));
  return prompt;
}

describe('InstallPwaButton', () => {
  it('opens the Android install prompt and hides after acceptance', async () => {
    render(<InstallPwaButton />);
    const prompt = dispatchInstallPrompt('accepted');
    const button = await screen.findByRole('button', { name: /instalar app/i });

    fireEvent.click(button);

    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('button', { name: /instalar app/i })).toBeNull());
  });

  it('keeps the install option available when the prompt is dismissed', async () => {
    render(<InstallPwaButton />);
    dispatchInstallPrompt('dismissed');
    const button = await screen.findByRole('button', { name: /instalar app/i });

    fireEvent.click(button);

    await waitFor(() => expect(screen.getByRole('button', { name: /instalar app/i })).toBeVisible());
  });
});
