// ==============================================================================
// AssetVault Design System: Base UI Components Unit Test Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Select,
  Skeleton,
  Tooltip,
  Avatar,
} from '../components/ui';

describe('AssetVault Base UI Components Suite', () => {
  describe('1. Button Component', () => {
    it('renders with default primary variant and md size', () => {
      const html = renderToStaticMarkup(<Button>Click Me</Button>);
      expect(html).toContain('Click Me');
      expect(html).toContain('bg-[var(--av-color-primary,#6366f1)]');
      expect(html).toContain('px-4');
    });

    it('renders secondary, ghost, and danger variants', () => {
      const secHtml = renderToStaticMarkup(<Button variant="secondary">Secondary</Button>);
      expect(secHtml).toContain('bg-[var(--av-color-card,#0f172a)]');

      const ghostHtml = renderToStaticMarkup(<Button variant="ghost">Ghost</Button>);
      expect(ghostHtml).toContain('bg-transparent');

      const dangerHtml = renderToStaticMarkup(<Button variant="danger">Delete</Button>);
      expect(dangerHtml).toContain('bg-[var(--av-color-danger,#f43f5e)]');
    });

    it('renders sm and lg sizes', () => {
      const smHtml = renderToStaticMarkup(<Button size="sm">Small</Button>);
      expect(smHtml).toContain('min-h-[32px]');

      const lgHtml = renderToStaticMarkup(<Button size="lg">Large</Button>);
      expect(lgHtml).toContain('min-h-[48px]');
    });

    it('renders loading spinner and disabled state when isLoading is true', () => {
      const html = renderToStaticMarkup(
        <Button isLoading loadingText="Saving...">
          Save
        </Button>
      );
      expect(html).toContain('disabled');
      expect(html).toContain('Saving...');
      expect(html).toContain('animate-spin');
    });

    it('renders left and right icon slots', () => {
      const html = renderToStaticMarkup(
        <Button
          iconLeft={<span id="left-icon">Left</span>}
          iconRight={<span id="right-icon">Right</span>}
        >
          Action
        </Button>
      );
      expect(html).toContain('id="left-icon"');
      expect(html).toContain('id="right-icon"');
      expect(html).toContain('Action');
    });
  });

  describe('2. Badge Component', () => {
    it('renders all badge variants', () => {
      const defaultHtml = renderToStaticMarkup(<Badge variant="default">Default</Badge>);
      expect(defaultHtml).toContain('bg-slate-800');

      const successHtml = renderToStaticMarkup(<Badge variant="success">Active</Badge>);
      expect(successHtml).toContain('text-[var(--av-color-success,#10b981)]');

      const warningHtml = renderToStaticMarkup(<Badge variant="warning">Expiring</Badge>);
      expect(warningHtml).toContain('text-[var(--av-color-warning,#f59e0b)]');

      const dangerHtml = renderToStaticMarkup(<Badge variant="danger">Expired</Badge>);
      expect(dangerHtml).toContain('text-[var(--av-color-danger,#f43f5e)]');

      const infoHtml = renderToStaticMarkup(<Badge variant="info">New</Badge>);
      expect(infoHtml).toContain('text-[var(--av-color-primary-light,#818cf8)]');

      const outlineHtml = renderToStaticMarkup(<Badge variant="outline">Outline</Badge>);
      expect(outlineHtml).toContain('bg-transparent');
    });

    it('renders pulsing dot indicator when dot is true', () => {
      const html = renderToStaticMarkup(
        <Badge variant="success" dot>
          Live
        </Badge>
      );
      expect(html).toContain('animate-pulse');
      expect(html).toContain('Live');
    });
  });

  describe('3. Card Component', () => {
    it('renders base card with header, body, and footer slots', () => {
      const html = renderToStaticMarkup(
        <Card>
          <CardHeader action={<button>Edit</button>}>Card Title</CardHeader>
          <CardBody>Card Body Content</CardBody>
          <CardFooter>Footer Info</CardFooter>
        </Card>
      );
      expect(html).toContain('Card Title');
      expect(html).toContain('Edit');
      expect(html).toContain('Card Body Content');
      expect(html).toContain('Footer Info');
      expect(html).toContain('bg-[var(--av-color-card,#0f172a)]');
    });

    it('applies hover elevation styling when hoverElevation is true', () => {
      const html = renderToStaticMarkup(<Card hoverElevation>Hoverable Card</Card>);
      expect(html).toContain('hover:-translate-y-0.5');
    });

    it('applies backdrop-blur glass-morphism when glass is true', () => {
      const html = renderToStaticMarkup(<Card glass>Glass Card</Card>);
      expect(html).toContain('backdrop-blur-md');
      expect(html).toContain('bg-slate-900/60');
    });
  });

  describe('4. Input Component', () => {
    it('renders label, input, and helper text', () => {
      const html = renderToStaticMarkup(
        <Input label="Workspace Name" helperText="Must be globally unique" />
      );
      expect(html).toContain('Workspace Name');
      expect(html).toContain('Must be globally unique');
      expect(html).toContain('border-[var(--av-color-border,#1e293b)]');
    });

    it('renders error state and error message', () => {
      const html = renderToStaticMarkup(
        <Input label="Email" error="Invalid email address format" />
      );
      expect(html).toContain('Invalid email address format');
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('border-[var(--av-color-danger,#f43f5e)]');
    });

    it('renders left icon and right action slots', () => {
      const html = renderToStaticMarkup(
        <Input
          iconLeft={<span id="search-icon">🔍</span>}
          rightAction={<span id="clear-btn">✖</span>}
        />
      );
      expect(html).toContain('id="search-icon"');
      expect(html).toContain('id="clear-btn"');
      expect(html).toContain('pl-9');
      expect(html).toContain('pr-10');
    });
  });

  describe('5. Select Component', () => {
    it('renders styled select with options and chevron icon', () => {
      const options = [
        { value: 'active', label: 'Active' },
        { value: 'expired', label: 'Expired' },
      ];
      const html = renderToStaticMarkup(
        <Select label="Filter Status" options={options} />
      );
      expect(html).toContain('Filter Status');
      expect(html).toContain('Active');
      expect(html).toContain('Expired');
      // Chevron SVG present
      expect(html).toContain('<svg');
    });

    it('renders error message when error prop is provided', () => {
      const html = renderToStaticMarkup(
        <Select label="Role" error="Please select a valid role" />
      );
      expect(html).toContain('Please select a valid role');
      expect(html).toContain('aria-invalid="true"');
    });
  });

  describe('6. Skeleton Component', () => {
    it('renders card, row, avatar, and text skeleton variants', () => {
      const cardHtml = renderToStaticMarkup(<Skeleton variant="card" />);
      expect(cardHtml).toContain('animate-pulse');
      expect(cardHtml).toContain('border');

      const rowHtml = renderToStaticMarkup(<Skeleton variant="row" />);
      expect(rowHtml).toContain('h-12');
      expect(rowHtml).toContain('animate-pulse');

      const avatarHtml = renderToStaticMarkup(<Skeleton variant="avatar" />);
      expect(avatarHtml).toContain('rounded-full');
      expect(avatarHtml).toContain('w-10 h-10');

      const textHtml = renderToStaticMarkup(<Skeleton variant="text" />);
      expect(textHtml).toContain('h-4');
    });
  });

  describe('7. Tooltip Component', () => {
    it('renders pure CSS hover tooltip structure with role="tooltip"', () => {
      const html = renderToStaticMarkup(
        <Tooltip content="Verified Organization" position="top">
          <button>Hover Me</button>
        </Tooltip>
      );
      expect(html).toContain('Hover Me');
      expect(html).toContain('Verified Organization');
      expect(html).toContain('role="tooltip"');
      expect(html).toContain('group-hover:opacity-100');
    });

    it('renders bottom, left, and right positions', () => {
      const btmHtml = renderToStaticMarkup(
        <Tooltip content="Bottom Tip" position="bottom">
          <span>Target</span>
        </Tooltip>
      );
      expect(btmHtml).toContain('top-full');

      const leftHtml = renderToStaticMarkup(
        <Tooltip content="Left Tip" position="left">
          <span>Target</span>
        </Tooltip>
      );
      expect(leftHtml).toContain('right-full');

      const rightHtml = renderToStaticMarkup(
        <Tooltip content="Right Tip" position="right">
          <span>Target</span>
        </Tooltip>
      );
      expect(rightHtml).toContain('left-full');
    });
  });

  describe('8. Avatar Component', () => {
    it('renders initials fallback when no image src is provided', () => {
      const html = renderToStaticMarkup(<Avatar name="John Doe" size="md" />);
      expect(html).toContain('JD');
      expect(html).toContain('rounded-full');
    });

    it('renders online status indicator dot', () => {
      const html = renderToStaticMarkup(<Avatar name="Jane Smith" isOnline />);
      expect(html).toContain('JS');
      expect(html).toContain('bg-[var(--av-color-success,#10b981)]');
      expect(html).toContain('aria-label="Status: online"');
    });

    it('renders image when src is provided', () => {
      const html = renderToStaticMarkup(
        <Avatar src="https://example.com/photo.jpg" alt="User Photo" />
      );
      expect(html).toContain('<img');
      expect(html).toContain('src="https://example.com/photo.jpg"');
      expect(html).toContain('alt="User Photo"');
    });
  });
});
