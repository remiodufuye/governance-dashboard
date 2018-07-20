import React, { Component } from 'react';
import styled from 'styled-components';
import theme, { shadows, colors } from '../theme';
import arrow from '../imgs/arrow.svg';

export default class Dropdown extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  toggle = () => {
    this.setState({ shown: !this.state.shown });
  };

  select(item) {
    this.setState({ selected: item, shown: false });
    this.props.onSelect(item);
  }

  render() {
    const { selected, shown } = this.state;
    const { items, itemKey, renderItem } = this.props;
    return (
      <Wrapper>
        <Selection onClick={this.toggle}>
          {selected ? renderItem(selected) : <div />}
          <Arrow />
        </Selection>
        {shown && (
          <List>
            {items.map(item => (
              <Row key={item[itemKey]} onClick={() => this.select(item)}>
                {renderItem(item)}
              </Row>
            ))}
          </List>
        )}
      </Wrapper>
    );
  }
}

const Wrapper = styled.div`
  position: relative;
`;

const Selection = styled.div`
  border: 1px solid #d1d8da;
  border-radius: 4px;
  position: relative;
  height: 40px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  cursor: pointer;
`;

export const Input = styled.input`
  border: none;
  color: ${theme.text.dim_grey_2};
  font-size: 16px;
  display: block;
  flex-grow: 1;
`;

const Arrow = styled.img`
  mask: url(${arrow}) center no-repeat;
  mask-size: 90%;
  background-color: black;
  height: 9px;
  width: 16px;
  margin-top: 5px;
  margin-left: 5px;
`;

const List = styled.div`
  width: 100%;
  position: absolute;
  top: 100%;
  margin-top: -2px;
  left: 0;
  background-color: white;
  z-index: 1;
  border: 1px solid #d1d8da;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  box-shadow: ${shadows.medium};
`;

const Row = styled.div`
  cursor: pointer;
  padding: 6px 8px;
  &:hover {
    background-color: rgb(${colors.light_grey});
  }
`;