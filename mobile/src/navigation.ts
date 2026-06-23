import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Tabs: undefined;
  PoolDetail: { poolId: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type RootStackNavProp = NativeStackNavigationProp<RootStackParamList>;
