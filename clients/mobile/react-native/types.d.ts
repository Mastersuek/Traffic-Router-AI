// Типы для React Native компонентов
declare module 'react-native' {
  export interface ViewProps {
    style?: any
    children?: React.ReactNode
  }
  
  export interface TextProps {
    style?: any
    children?: React.ReactNode
  }
  
  export interface StyleSheetStatic {
    create<T>(styles: T): T
  }
  
  export interface SwitchProps {
    value?: boolean
    onValueChange?: (value: boolean) => void
    style?: any
  }
  
  export interface TouchableOpacityProps {
    onPress?: () => void
    style?: any
    children?: React.ReactNode
  }
  
  export interface ScrollViewProps {
    style?: any
    children?: React.ReactNode
  }
  
  export interface AlertStatic {
    alert(title: string, message?: string, buttons?: any[]): void
  }
  
  export interface StatusBarProps {
    barStyle?: 'default' | 'light-content' | 'dark-content'
    backgroundColor?: string
  }
  
  export const View: React.ComponentType<ViewProps>
  export const Text: React.ComponentType<TextProps>
  export const StyleSheet: StyleSheetStatic
  export const Switch: React.ComponentType<SwitchProps>
  export const TouchableOpacity: React.ComponentType<TouchableOpacityProps>
  export const ScrollView: React.ComponentType<ScrollViewProps>
  export const Alert: AlertStatic
  export const StatusBar: React.ComponentType<StatusBarProps>
}