import { getClerkInstance, useSignIn } from '@clerk/clerk-expo';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { clerkErrorMessage } from '@/lib/clerkErrorMessage';
import { colors, spacing, typography } from '@/theme';

const LoginFormSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginForm = z.infer<typeof LoginFormSchema>;

/**
 * Mirrors the web's `NEXT_PUBLIC_FIELD_TEST_MODE`: with the flag on, the seeded accounts are
 * already in the fields. Off by default and absent from production builds, since the value is
 * inlined at bundle time.
 *
 * This is not only a convenience. Typing a full email into a slow emulator drops characters, so
 * every device check began with two minutes of retyping credentials — which is the sort of
 * friction that quietly stops anyone from testing on a device at all.
 */
const fieldTestMode = process.env.EXPO_PUBLIC_FIELD_TEST_MODE === 'true';
const fieldTestPassword = 'CutgTest2026!';

export default function LoginScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ role?: string }>();
  const expectedRole = params.role === 'BARBER' ? 'BARBER' : 'CLIENT';
  const { isLoaded, signIn, setActive } = useSignIn();
  const { control, formState, handleSubmit, setError } = useForm<LoginForm>({
    defaultValues: fieldTestMode
      ? {
          email: expectedRole === 'BARBER' ? 'barber.test@example.com' : 'client.test@example.com',
          password: fieldTestPassword,
        }
      : {
          email: '',
          password: '',
        },
    resolver: zodResolver(LoginFormSchema),
  });

  const onSubmit = async (values: LoginForm): Promise<void> => {
    if (!isLoaded) {
      return;
    }
    try {
      const clerk = getClerkInstance();
      if (clerk.session !== null && clerk.session !== undefined) {
        await clerk.signOut();
      }

      const result = await signIn.create({
        identifier: values.email,
        password: values.password,
      });

      if (result.status !== 'complete' || result.createdSessionId === null) {
        setError('root', { message: 'Sign in could not be completed. Please try again.' });
        return;
      }

      await setActive({ session: result.createdSessionId });

      const userType = getClerkInstance().user?.publicMetadata?.userType;
      if (userType !== undefined && userType !== expectedRole) {
        await getClerkInstance().signOut();
        setError('root', {
          message:
            expectedRole === 'BARBER'
              ? 'This is a customer account. Use customer sign in instead.'
              : 'This is a barber account. Use barber sign in instead.',
        });
        return;
      }

      router.replace(expectedRole === 'BARBER' ? '/(barber)/today' : '/(client)/discover');
    } catch (error) {
      setError('root', { message: clerkErrorMessage(error, 'Sign in failed. Please try again.') });
    }
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title={expectedRole === 'BARBER' ? 'Barber sign in' : 'Customer sign in'}
        subtitle={
          expectedRole === 'BARBER' ? 'Open your business workspace.' : 'Manage your bookings.'
        }
      />
      {fieldTestMode ? (
        <Text style={styles.fieldTest}>
          Field-test mode: the seeded {expectedRole === 'BARBER' ? 'barber' : 'customer'} account is
          filled in.
        </Text>
      ) : null}
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Input
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <Input
            label="Password"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            secureTextEntry
            value={field.value}
            error={fieldState.error?.message}
          />
        )}
      />
      {formState.errors.root?.message !== undefined ? (
        <Text style={styles.error}>{formState.errors.root.message}</Text>
      ) : null}
      <Button
        disabled={formState.isSubmitting}
        loading={formState.isSubmitting}
        title="Sign in"
        onPress={handleSubmit(onSubmit)}
      />
      <Button
        title="Forgot password?"
        onPress={() => router.push('/(auth)/forgot-password')}
        variant="ghost"
      />
      <Button
        title={`Create ${expectedRole === 'BARBER' ? 'barber' : 'customer'} account`}
        onPress={() => router.push('/(auth)/register?role=' + expectedRole)}
        variant="secondary"
      />
      <Button
        title={expectedRole === 'BARBER' ? 'Customer sign in' : 'Barber sign in'}
        onPress={() =>
          router.replace('/(auth)/login?role=' + (expectedRole === 'BARBER' ? 'CLIENT' : 'BARBER'))
        }
        variant="ghost"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    ...typography.bodySmall,
    color: colors.error,
  },
  fieldTest: {
    ...typography.bodySmall,
    backgroundColor: colors.statusConfirmedSurface,
    borderColor: colors.statusConfirmed,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.statusConfirmed,
    overflow: 'hidden',
    padding: spacing.md,
  },
});
