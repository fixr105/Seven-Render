import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../LoginPage';
import { apiService } from '../../services/api';
import { renderWithProviders } from '../../test/helpers';
import i18n from '../../i18n';

vi.mock('../../services/api', () => ({
  apiService: {
    login: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn(),
  },
}));

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(matches: (query: string) => boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function mockCanvas() {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    stroke: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

type DrawnCircle = { x: number; y: number; r: number };

function mockRecordingCanvas() {
  const circles: DrawnCircle[] = [];
  let points: { x: number; y: number }[] = [];
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: () => {
      points = [];
    },
    moveTo: (x: number, y: number) => {
      points.push({ x, y });
    },
    lineTo: (x: number, y: number) => {
      points.push({ x, y });
    },
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: () => {
      if (points.length < 3) return;
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      circles.push({
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (minY + maxY) / 2,
        r: (maxY - minY) / 2,
      });
    },
    stroke: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return circles;
}

function driveFrames(now: { value: number }, queue: FrameRequestCallback[], ms: number) {
  const steps = Math.max(1, Math.round(ms / 16));
  for (let step = 0; step < steps; step += 1) {
    now.value += 16;
    const callback = queue.shift();
    if (!callback) break;
    callback(now.value);
  }
}

async function renderLogin() {
  await i18n.changeLanguage('en');
  const view = renderWithProviders(<LoginPage />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('login-username'), 'dealer@example.com');
  await user.type(screen.getByTestId('login-password'), 'secret');
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(apiService.getMe).mockResolvedValue({ success: false });
    vi.mocked(apiService.logout).mockResolvedValue({ success: true });
    vi.mocked(apiService.login).mockReset();
    mockCanvas();
    mockMatchMedia(() => false);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('calls the same login handler from Enter and the submit button', async () => {
    const user = userEvent.setup();
    vi.mocked(apiService.login).mockResolvedValue({ success: false, error: 'Invalid email or password' });
    await renderLogin();

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => {
      expect(apiService.login).toHaveBeenCalledWith('dealer@example.com', 'secret');
    });

    vi.mocked(apiService.login).mockClear();
    await user.click(screen.getByTestId('login-password'));
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(apiService.login).toHaveBeenCalledWith('dealer@example.com', 'secret');
    });
  });

  it('disables the button and shows the spinner while login is pending', async () => {
    const user = userEvent.setup();
    let settle: (value: { success: boolean; error: string }) => void = () => {};
    vi.mocked(apiService.login).mockImplementation(
      () => new Promise((resolve) => {
        settle = resolve;
      }),
    );
    await renderLogin();
    await fillCredentials(user);

    const button = screen.getByRole('button', { name: 'Log in' });
    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    expect(button.querySelector('svg.animate-spin')).toBeTruthy();
    expect(button).toHaveTextContent('Loading...');

    await act(async () => {
      settle({ success: false, error: 'Invalid email or password' });
    });
  });

  it('does not overflow horizontally at 390px', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    await renderLogin();

    const page = screen.getByTestId('login-page');
    const canvas = screen.getByTestId('cursor-wave');
    expect(page.className).toContain('overflow-x-hidden');
    expect(page.className).toContain('px-4');
    expect(canvas).toHaveStyle({ width: '390px' });
    expect(page.scrollWidth).toBeLessThanOrEqual(Math.max(page.clientWidth, 390));
  });

  it('keeps the canvas out of hit testing so the fields stay clickable', async () => {
    await renderLogin();
    const canvas = screen.getByTestId('cursor-wave');
    expect(canvas).toHaveStyle({ pointerEvents: 'none' });
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('login-username')).not.toHaveStyle({ pointerEvents: 'none' });
    expect(screen.getByTestId('login-password')).not.toHaveStyle({ pointerEvents: 'none' });
    expect(screen.getByRole('button', { name: 'Log in' })).not.toHaveStyle({ pointerEvents: 'none' });
  });

  it('does not start an animation frame loop when reduced motion is requested', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    mockMatchMedia((query) => query.includes('prefers-reduced-motion'));
    await renderLogin();
    expect(screen.getByTestId('cursor-wave')).toBeInTheDocument();
    expect(raf).not.toHaveBeenCalled();
  });

  it('swells circles around a click, then lets them relax', async () => {
    const circles = mockRecordingCanvas();
    const now = { value: 1000 };
    vi.spyOn(performance, 'now').mockImplementation(() => now.value);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
    const queue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      queue.push(callback);
      return queue.length;
    });
    const nearestRadius = () => {
      const near = circles.filter((circle) => Math.hypot(circle.x - 16, circle.y - 16) < 20);
      return near.length ? near[near.length - 1].r : 0;
    };
    await renderLogin();
    driveFrames(now, queue, 32);
    const idleRadius = nearestRadius();

    window.dispatchEvent(new MouseEvent('pointerdown', { clientX: 16, clientY: 16, bubbles: true }));
    circles.length = 0;
    driveFrames(now, queue, 64);
    const burstRadius = nearestRadius();

    circles.length = 0;
    driveFrames(now, queue, 1600);
    const relaxedRadius = nearestRadius();

    expect(burstRadius).toBeGreaterThan(idleRadius + 0.4);
    expect(relaxedRadius).toBeLessThan(burstRadius);
  });

  it('orbits a wave on a coarse pointer and ignores the cursor', async () => {
    const circles = mockRecordingCanvas();
    const now = { value: 0 };
    vi.spyOn(performance, 'now').mockImplementation(() => now.value);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
    mockMatchMedia((query) => query.includes('pointer: coarse'));
    const queue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      queue.push(callback);
      return queue.length;
    });
    await renderLogin();
    driveFrames(now, queue, 500);
    const swollen = circles.filter((circle) => circle.r > 4.5);
    const centroid = (items: DrawnCircle[]) => ({
      x: items.reduce((sum, circle) => sum + circle.x, 0) / items.length,
      y: items.reduce((sum, circle) => sum + circle.y, 0) / items.length,
    });
    expect(swollen.length).toBeGreaterThan(0);
    const rightOfCentre = centroid(swollen);
    expect(rightOfCentre.x).toBeGreaterThan(480);

    circles.length = 0;
    driveFrames(now, queue, 2000);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 12, clientY: 12, bubbles: true }));
    circles.length = 0;
    driveFrames(now, queue, 400);
    const later = circles.filter((circle) => circle.r > 4.5);
    expect(later.length).toBeGreaterThan(0);
    const belowCentre = centroid(later);
    expect(belowCentre.y).toBeGreaterThan(rightOfCentre.y + 40);
    expect(belowCentre.x).toBeLessThan(rightOfCentre.x - 40);
    expect(belowCentre.x).toBeGreaterThan(200);
  });

  it('shows the English tagline', async () => {
    await renderLogin();
    expect(screen.getByText('Make More, Every Month.')).toBeInTheDocument();
  });

  it('does not use the dark login treatment', async () => {
    await renderLogin();
    const tree = document.body.innerHTML;
    expect(tree).not.toContain('login-bg');
    expect(tree).not.toContain('backdrop-filter');
    expect(tree).not.toContain('linear-gradient');
    const button = screen.getByRole('button', { name: 'Log in' });
    expect(button.className).toContain('!bg-dealer-navy');
    expect(button.className).not.toContain('login-btn');
  });
});
