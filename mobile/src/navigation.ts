import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Auth: undefined;
  Tabs: undefined;
  PoolDetail: { poolId: string };
  OfficialRules: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type RootStackNavProp = NativeStackNavigationProp<RootStackParamList>;
