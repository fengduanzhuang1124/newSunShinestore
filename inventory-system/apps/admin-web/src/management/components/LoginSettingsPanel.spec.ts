import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoginSettingsPanel from './LoginSettingsPanel.vue';

const settings = () => ({
  store: { id: '1', name: '第一门店', latitude: null, longitude: null, radius: 300 },
  radiusOptions: [100, 200, 300, 500, 1000],
  users: [
    { id: '9', username: 'wf1124', displayName: '管理员', inStoreOnly: false, administrator: true, roles: ['管理员'] },
    { id: '1', username: 'wf66', displayName: '员工1', inStoreOnly: false, administrator: false, roles: ['店员'] },
  ],
});

describe('LoginSettingsPanel (CR-025)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('sets the store position from the phone and limits a staff account', async () => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: -37.7871234, longitude: 175.2791234, accuracy: 18.2 } } as GeolocationPosition) } });
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/management/login-settings/store')) return { id: '1', name: '第一门店', ...JSON.parse(String(init?.body)) };
      if (path.startsWith('/management/login-settings/user')) return { id: '1', inStoreOnly: true };
      return settings();
    });
    const wrapper = mount(LoginSettingsPanel, { props: { storeId: '1', request: request as never } });
    await flushPromises();
    expect(wrapper.text()).toContain('未设置');
    expect(wrapper.text()).toContain('管理员不限制');

    await wrapper.findAll('button').find((button) => button.text() === '用当前位置')!.trigger('click');
    expect(wrapper.text()).toContain('误差约 18 米');
    await wrapper.findAll('button').find((button) => button.text() === '保存门店位置')!.trigger('click');
    await flushPromises();
    expect(request).toHaveBeenCalledWith('/management/login-settings/store?storeId=1', { method: 'POST', body: JSON.stringify({ latitude: -37.787123, longitude: 175.279123, radius: 300 }) });
    expect(wrapper.text()).toContain('在地图上查看');

    await wrapper.get('input[aria-label="员工1 仅限店内登录"]').setValue(true);
    await flushPromises();
    expect(request).toHaveBeenLastCalledWith('/management/login-settings/user?storeId=1', { method: 'POST', body: JSON.stringify({ userId: '1', inStoreOnly: true }) });
    expect(wrapper.text()).toContain('1 个已限制');
    expect(wrapper.text()).toContain('已设置为仅限店内登录，下次登录时生效');
  });

  it('shows the server message when the user is not an administrator', async () => {
    const request = vi.fn(async () => { throw new Error('只有管理员可以设置登录限制'); });
    const wrapper = mount(LoginSettingsPanel, { props: { storeId: '1', request: request as never } });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('只有管理员可以设置登录限制');
  });
});
