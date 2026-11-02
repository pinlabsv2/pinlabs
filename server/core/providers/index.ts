export * from './types.js';
export * from './nowPayments.js';
export * from './resend.js';
export * from './track17.js';
export * from './vercelBlob.js';
export * from './fakes.js';

import { CaptureEmailProvider, FakePaymentProvider, FakePayoutProvider, FakeReviewImageStorage, FakeTrackingProvider } from './fakes.js';
import { NowPaymentsProvider } from './nowPayments.js';
import { ResendProvider } from './resend.js';
import { Track17Provider } from './track17.js';
import { VercelBlobStorage } from './vercelBlob.js';

export function createProviderBundle(env: NodeJS.ProcessEnv = process.env) {
  const fakePayments = (env.PAYMENT_PROVIDER_MODE || 'fake') === 'fake';
  const fakeEmail = (env.EMAIL_PROVIDER_MODE || 'fake') === 'fake';
  const fakeTracking = (env.TRACKING_PROVIDER_MODE || (env.TRACK17_API_KEY ? 'live' : 'fake')) === 'fake';
  const fakeStorage = (env.REVIEW_IMAGE_PROVIDER_MODE || 'fake') === 'fake';
  return {
    payment: fakePayments ? new FakePaymentProvider() : new NowPaymentsProvider(env),
    payout: fakePayments ? new FakePayoutProvider() : new NowPaymentsProvider(env),
    email: fakeEmail ? new CaptureEmailProvider() : new ResendProvider(env),
    tracking: fakeTracking ? new FakeTrackingProvider() : new Track17Provider(env),
    reviewImages: fakeStorage ? new FakeReviewImageStorage() : new VercelBlobStorage(env),
  };
}
