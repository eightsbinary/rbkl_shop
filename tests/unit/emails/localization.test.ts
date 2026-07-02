import { render } from '@react-email/components';
import OrderPaid, { subject as orderPaidSubject } from 'emails/OrderPaid';
import OrderShipped, { subject as orderShippedSubject } from 'emails/OrderShipped';
import SlipReceived, { subject as slipReceivedSubject } from 'emails/SlipReceived';
import SlipRejected, { subject as slipRejectedSubject } from 'emails/SlipRejected';
import WaitlistRestock, { subject as waitlistRestockSubject } from 'emails/WaitlistRestock';
import { describe, expect, it } from 'vitest';

const hasThai = (s: string) => /[฀-๿]/.test(s);

describe('email localization', () => {
  it('renders OrderPaid in the buyer language', async () => {
    const th = await render(
      OrderPaid({ locale: 'th', orderNumber: 'RB-1', orderUrl: '#', items: [], totalLabel: '฿1' }),
    );
    const en = await render(
      OrderPaid({ locale: 'en', orderNumber: 'RB-1', orderUrl: '#', items: [], totalLabel: '฿1' }),
    );
    expect(th).toContain('ขอบคุณค่ะ');
    // Note: the ฿ sign lives in the Thai Unicode block, so assert on copy, not glyph block.
    expect(en).toContain('Thank you');
    expect(en).not.toContain('ขอบคุณค่ะ');
  });

  it('renders OrderShipped in the buyer language', async () => {
    const th = await render(
      OrderShipped({
        locale: 'th',
        orderNumber: 'RB-1',
        carrier: 'thailand_post',
        trackingNumber: 'T1',
        trackingUrl: '#',
        orderUrl: '#',
      }),
    );
    expect(th).toContain('กำลังจัดส่ง');
  });

  it('renders SlipReceived and SlipRejected in Thai', async () => {
    const received = await render(
      SlipReceived({ locale: 'th', orderNumber: 'RB-1', orderUrl: '#' }),
    );
    const rejected = await render(
      SlipRejected({ locale: 'th', orderNumber: 'RB-1', orderUrl: '#', reason: 'blurry' }),
    );
    expect(received).toContain('ได้รับสลิปแล้ว');
    expect(rejected).toContain('ไม่สามารถยืนยัน');
    // Admin reason is shown verbatim, never translated.
    expect(rejected).toContain('blurry');
  });

  it('renders WaitlistRestock in the buyer language', async () => {
    const th = await render(
      WaitlistRestock({ locale: 'th', productName: 'Riso', productUrl: '#' }),
    );
    expect(th).toContain('กลับมาวางขาย');
  });

  it('localizes subject lines', () => {
    expect(hasThai(orderPaidSubject('th', 'RB-1'))).toBe(true);
    expect(hasThai(orderPaidSubject('en', 'RB-1'))).toBe(false);
    expect(hasThai(orderShippedSubject('th', 'RB-1'))).toBe(true);
    expect(hasThai(slipReceivedSubject('th', 'RB-1'))).toBe(true);
    expect(hasThai(slipRejectedSubject('th', 'RB-1'))).toBe(true);
    expect(hasThai(waitlistRestockSubject('th', 'Riso'))).toBe(true);
  });
});
