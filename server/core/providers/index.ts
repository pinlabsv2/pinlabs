export * from './types';
export * from './nowPayments';
export * from './resend';
export * from './track17';
export * from './vercelBlob';
export * from './fakes';

import { CaptureEmailProvider, FakePaymentProvider, FakePayoutProvider, FakeReviewImageStorage, FakeTrackingProvider } from './fakes';
import { NowPaymentsProvider } from './nowPayments';
import { ResendProvider } from './resend';
import { Track17Provider } from './track17';
import { VercelBlobStorage } from './vercelBlob';

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
